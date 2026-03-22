import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { nanoid } from 'nanoid';

import { PrismaService } from '../prisma/prisma.service';
import { CompleteFileDto } from './dto';
import { OssService } from './oss.service';

export interface UploadStatus {
  fileId: string;
  totalChunks: number;
  uploadedChunks: number[];
  isComplete: boolean;
}

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly tempDir: string;
  private readonly filesDir: string;
  private readonly avatarsDir: string;
  private uploadStatusMap: Map<string, UploadStatus> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ossService: OssService,
  ) {
    // Use the backend root as base for uploads
    this.uploadDir = path.join(process.cwd(), '..', 'uploads');
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.filesDir = path.join(this.uploadDir, 'files');
    this.avatarsDir = path.join(this.uploadDir, 'avatars');

    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.uploadDir, this.tempDir, this.filesDir, this.avatarsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // ==================== 秒传检查 ====================

  /**
   * 秒传检查 - 根据文件hash检查文件是否已存在
   */
  async checkFile(fileHash: string): Promise<{
    exists: boolean;
    fileId?: string;
    filePath?: string;
    fileName?: string;
  }> {
    const existingFile = await this.prisma.files.findUnique({
      where: { file_hash: fileHash },
    });

    if (existingFile && existingFile.is_complete) {
      return {
        exists: true,
        fileId: existingFile.file_id,
        filePath: existingFile.file_path,
        fileName: existingFile.file_name,
      };
    }

    return { exists: false };
  }

  // ==================== 分片上传 ====================

  /**
   * 获取已上传的分片信息
   */
  async getChunkInfo(fileId: string): Promise<{
    fileId: string;
    uploadedChunks: number[];
    isComplete: boolean;
  }> {
    const status = this.uploadStatusMap.get(fileId);

    if (status) {
      return {
        fileId,
        uploadedChunks: status.uploadedChunks,
        isComplete: status.isComplete,
      };
    }

    // Check if file is already complete in database
    const fileRecord = await this.prisma.files.findUnique({
      where: { file_id: fileId },
    });

    if (fileRecord?.is_complete) {
      return {
        fileId,
        uploadedChunks: [],
        isComplete: true,
      };
    }

    // Check temp directory for uploaded chunks
    const tempFileDir = path.join(this.tempDir, fileId);
    if (fs.existsSync(tempFileDir)) {
      const chunks = fs
        .readdirSync(tempFileDir)
        .filter((f) => f.startsWith('chunk_'))
        .map((f) => parseInt(f.replace('chunk_', ''), 10))
        .sort((a, b) => a - b);

      return {
        fileId,
        uploadedChunks: chunks,
        isComplete: false,
      };
    }

    return {
      fileId,
      uploadedChunks: [],
      isComplete: false,
    };
  }

  /**
   * 上传单个分片
   */
  uploadChunk(
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    _fileHash: string,
    chunkBuffer: Buffer,
  ): Promise<{
    success: boolean;
    uploadedChunks: number[];
    isComplete: boolean;
  }> {
    const tempFileDir = path.join(this.tempDir, fileId);

    // Ensure temp directory exists
    if (!fs.existsSync(tempFileDir)) {
      fs.mkdirSync(tempFileDir, { recursive: true });
    }

    // Save chunk
    const chunkPath = path.join(tempFileDir, `chunk_${chunkIndex}`);
    fs.writeFileSync(chunkPath, chunkBuffer);

    // Update upload status
    let status = this.uploadStatusMap.get(fileId);
    if (!status) {
      status = {
        fileId,
        totalChunks,
        uploadedChunks: [],
        isComplete: false,
      };
      this.uploadStatusMap.set(fileId, status);
    }

    if (!status.uploadedChunks.includes(chunkIndex)) {
      status.uploadedChunks.push(chunkIndex);
    }

    // Sort uploaded chunks
    status.uploadedChunks.sort((a, b) => a - b);

    return Promise.resolve({
      success: true,
      uploadedChunks: status.uploadedChunks,
      isComplete: status.uploadedChunks.length === totalChunks,
    });
  }

  // ==================== 文件合并 ====================

  /**
   * 合并分片并完成上传
   */
  async completeFile(
    dto: CompleteFileDto,
    userId: string,
  ): Promise<{
    success: boolean;
    fileId: string;
    filePath: string;
    url: string;
  }> {
    const { fileId, fileName, fileHash, fileSize, mimeType, totalChunks = 0 } = dto;

    // Check if file already exists (fast upload)
    const existingCheck = await this.checkFile(fileHash);
    if (existingCheck.exists) {
      return {
        success: true,
        fileId: existingCheck.fileId!,
        filePath: existingCheck.filePath!,
        url: `/uploads/files/${path.basename(existingCheck.filePath!)}`,
      };
    }

    // Merge chunks if needed
    let finalFilePath: string;

    if (totalChunks > 1) {
      // Merge chunks
      finalFilePath = await this.mergeChunks(fileId, fileName, totalChunks);
    } else {
      // Single file upload - move from temp
      const tempFileDir = path.join(this.tempDir, fileId);
      const chunkPath = path.join(tempFileDir, 'chunk_0');

      if (!fs.existsSync(chunkPath)) {
        throw new BadRequestException('文件分片不存在');
      }

      // Move to final location
      const dateDir = new Date().toISOString().split('T')[0];
      const finalDir = path.join(this.filesDir, dateDir);
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }

      finalFilePath = path.join(finalDir, `${fileId}_${fileName}`);
      fs.renameSync(chunkPath, finalFilePath);

      // Clean up temp directory
      fs.rmSync(tempFileDir, { recursive: true, force: true });
    }

    // Verify file hash
    const calculatedHash = await this.calculateFileHash(finalFilePath);
    if (calculatedHash !== fileHash) {
      // Remove corrupted file
      fs.unlinkSync(finalFilePath);
      throw new BadRequestException('文件校验失败，请重新上传');
    }

    // Save to database
    await this.prisma.files.create({
      data: {
        file_id: fileId,
        file_hash: fileHash,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        file_path: finalFilePath,
        user_id: userId,
        chunk_count: totalChunks,
        is_complete: true,
      },
    });

    // Clean up upload status
    this.uploadStatusMap.delete(fileId);

    // Generate relative URL
    const relativePath = path.relative(this.uploadDir, finalFilePath);

    return {
      success: true,
      fileId,
      filePath: finalFilePath,
      url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
    };
  }

  /**
   * 合并分片文件
   */
  private async mergeChunks(
    fileId: string,
    fileName: string,
    totalChunks: number,
  ): Promise<string> {
    const tempFileDir = path.join(this.tempDir, fileId);

    // Check all chunks exist
    const missingChunks: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempFileDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      throw new BadRequestException(`缺少分片: ${missingChunks.join(', ')}`);
    }

    // Create final directory
    const dateDir = new Date().toISOString().split('T')[0];
    const finalDir = path.join(this.filesDir, dateDir);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const finalFilePath = path.join(finalDir, `${fileId}_${fileName}`);
    const writeStream = fs.createWriteStream(finalFilePath);

    try {
      // Merge chunks in order
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempFileDir, `chunk_${i}`);
        const chunkBuffer = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuffer);
      }

      writeStream.end();

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Clean up temp directory
      fs.rmSync(tempFileDir, { recursive: true, force: true });

      return finalFilePath;
    } catch (error) {
      // Clean up on error
      writeStream.destroy();
      if (fs.existsSync(finalFilePath)) {
        fs.unlinkSync(finalFilePath);
      }
      throw error;
    }
  }

  // ==================== 上传状态管理 ====================

  /**
   * 获取上传状态
   */
  async getUploadStatus(fileId: string): Promise<UploadStatus | null> {
    const status = this.uploadStatusMap.get(fileId);

    if (status) {
      return status;
    }

    // Check database
    const fileRecord = await this.prisma.files.findUnique({
      where: { file_id: fileId },
    });

    if (fileRecord) {
      return {
        fileId,
        totalChunks: fileRecord.chunk_count || 0,
        uploadedChunks: [],
        isComplete: fileRecord.is_complete,
      };
    }

    return null;
  }

  /**
   * 取消上传并清理临时文件
   */
  async cancelUpload(fileId: string, userId: string): Promise<{ success: boolean }> {
    // Clean up temp directory
    const tempFileDir = path.join(this.tempDir, fileId);
    if (fs.existsSync(tempFileDir)) {
      fs.rmSync(tempFileDir, { recursive: true, force: true });
    }

    // Remove from status map
    this.uploadStatusMap.delete(fileId);

    // Remove from database if exists
    try {
      const fileRecord = await this.prisma.files.findUnique({
        where: { file_id: fileId },
      });

      if (fileRecord && fileRecord.user_id === userId) {
        await this.prisma.files.delete({
          where: { file_id: fileId },
        });

        // Remove file if exists
        if (fs.existsSync(fileRecord.file_path)) {
          fs.unlinkSync(fileRecord.file_path);
        }
      }
    } catch {
      // Ignore errors for non-existent records
    }

    return { success: true };
  }

  // ==================== 编辑器图片（OSS） ====================

  /**
   * 上传编辑器内图片至阿里云 OSS，返回公网可访问 URL
   */
  async uploadEditorImage(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
  ): Promise<{ url: string }> {
    if (!this.ossService.isEnabled()) {
      throw new ServiceUnavailableException(
        '未配置阿里云 OSS，请在服务端环境变量中填写 OSS_REGION、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET',
      );
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException('仅支持 JPEG、PNG、GIF、WebP、SVG 格式的图片');
    }

    const maxSize = 5 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new BadRequestException('图片大小不能超过 5MB');
    }

    const ext = this.resolveImageExtension(originalName, mimeType);
    const dateDir = new Date().toISOString().split('T')[0];
    const objectKey = `editor-images/${userId}/${dateDir}/${nanoid()}${ext}`;

    const url = await this.ossService.uploadBuffer(objectKey, fileBuffer, mimeType);
    return { url };
  }

  private resolveImageExtension(originalName: string, mimeType: string): string {
    const fromName = path.extname(originalName).toLowerCase();
    if (fromName && fromName.length <= 8) {
      return fromName;
    }

    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };

    return map[mimeType] ?? '.jpg';
  }

  // ==================== 头像上传 ====================

  /**
   * 上传头像
   */
  async uploadAvatar(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
  ): Promise<{
    success: boolean;
    url: string;
    fileName: string;
  }> {
    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException('仅支持 JPEG, PNG, GIF, WebP 格式的图片');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new BadRequestException('头像文件大小不能超过 5MB');
    }

    // Create user avatar directory
    const userAvatarDir = path.join(this.avatarsDir, userId);
    if (!fs.existsSync(userAvatarDir)) {
      fs.mkdirSync(userAvatarDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(originalName) || '.jpg';
    const fileName = `${Date.now()}${ext}`;
    const filePath = path.join(userAvatarDir, fileName);

    // Save file
    fs.writeFileSync(filePath, fileBuffer);

    // Generate URL
    const url = `/uploads/avatars/${userId}/${fileName}`;

    // Update user avatar in database
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { avatar_url: url },
    });

    return {
      success: true,
      url,
      fileName,
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 计算文件 MD5 hash
   */
  private calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
