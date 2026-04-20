import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { nanoid } from 'nanoid';

import { PrismaService } from '../prisma/prisma.service';
import { CompleteFileDto } from './dto';
import { EditorImageDirectUploadCredential, OssService } from './oss.service';

export interface UploadStatus {
  fileId: string;
  totalChunks: number;
  uploadedChunks: number[];
  isComplete: boolean;
}

export type EditorImageDirectUploadSession =
  | {
      alreadyExists: true;
      objectKey: string;
      url: string;
    }
  | ({ alreadyExists: false } & EditorImageDirectUploadCredential);

const EDITOR_IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
const EDITOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

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
    url?: string;
    fileUrl?: string;
  }> {
    const existingFile = await this.prisma.files.findUnique({
      where: { file_hash: fileHash },
    });

    if (existingFile && !existingFile.is_complete) {
      return { exists: false };
    }

    if (existingFile && existingFile.is_complete) {
      const url = this.toPublicUploadUrl(existingFile.file_path);
      return {
        exists: true,
        fileId: existingFile.file_id,
        filePath: existingFile.file_path,
        fileName: existingFile.file_name,
        url,
        fileUrl: url,
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
    totalChunks: number;
    isComplete: boolean;
  }> {
    const status = this.uploadStatusMap.get(fileId);

    if (status) {
      return {
        fileId,
        uploadedChunks: status.uploadedChunks,
        totalChunks: status.totalChunks,
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
        totalChunks: fileRecord.chunk_count || 0,
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
        totalChunks: 0,
        isComplete: false,
      };
    }

    return {
      fileId,
      uploadedChunks: [],
      totalChunks: 0,
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
    chunkHash?: string,
  ): Promise<{
    success: boolean;
    uploadedChunks: number[];
    isComplete: boolean;
  }> {
    if (!fileId || fileId.length > 21) {
      throw new BadRequestException('fileId 无效，长度需在 1-21 之间');
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new BadRequestException('chunkIndex 必须是大于等于 0 的整数');
    }
    if (!Number.isInteger(totalChunks) || totalChunks < 1) {
      throw new BadRequestException('totalChunks 必须是大于等于 1 的整数');
    }
    if (chunkIndex >= totalChunks) {
      throw new BadRequestException('chunkIndex 不能大于等于 totalChunks');
    }
    if (chunkHash) {
      const calculatedHash = this.calculateBufferHash(chunkBuffer);
      if (calculatedHash !== chunkHash) {
        throw new BadRequestException('分片校验失败，请重试');
      }
    }

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
    status.totalChunks = totalChunks;

    if (!status.uploadedChunks.includes(chunkIndex)) {
      status.uploadedChunks.push(chunkIndex);
    }

    // Sort uploaded chunks
    status.uploadedChunks.sort((a, b) => a - b);
    status.isComplete = status.uploadedChunks.length === totalChunks;

    return Promise.resolve({
      success: true,
      uploadedChunks: status.uploadedChunks,
      isComplete: status.isComplete,
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
    fileUrl: string;
  }> {
    const { fileId, fileName, fileHash, fileSize, mimeType } = dto;
    const totalChunks = dto.totalChunks && dto.totalChunks > 0 ? dto.totalChunks : 1;

    if (!fileId || fileId.length > 21) {
      throw new BadRequestException('fileId 无效，长度需在 1-21 之间');
    }
    if (typeof fileSize !== 'number' || !Number.isInteger(fileSize) || fileSize < 1) {
      throw new BadRequestException('fileSize 必须是大于等于 1 的整数');
    }

    // Check if file already exists (fast upload)
    const existingCheck = await this.checkFile(fileHash);
    if (existingCheck.exists) {
      const url = existingCheck.url || this.toPublicUploadUrl(existingCheck.filePath!);
      return {
        success: true,
        fileId: existingCheck.fileId!,
        filePath: existingCheck.filePath!,
        url,
        fileUrl: url,
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
    const url = this.toPublicUploadUrl(finalFilePath);

    return {
      success: true,
      fileId,
      filePath: finalFilePath,
      url,
      fileUrl: url,
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
    _originalName: string,
    mimeType: string,
    userId: string,
  ): Promise<{ url: string }> {
    if (!this.ossService.isEnabled()) {
      throw new ServiceUnavailableException(
        '未配置阿里云 OSS，请在服务端环境变量中填写 OSS_REGION、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET',
      );
    }

    if (!EDITOR_IMAGE_ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestException('仅支持 JPEG、PNG、GIF、WebP、SVG 格式的图片');
    }

    if (fileBuffer.length > EDITOR_IMAGE_MAX_BYTES) {
      throw new BadRequestException('图片大小不能超过 10MB');
    }

    const contentHash = this.calculateBufferSha256(fileBuffer);
    const objectKey = this.buildEditorImageObjectKey(userId, contentHash);
    const url = this.ossService.buildPublicObjectUrl(objectKey);
    const exists = await this.ossService.objectExists(objectKey);
    if (exists) {
      return { url };
    }

    try {
      const uploadedUrl = await this.ossService.uploadBuffer(objectKey, fileBuffer, mimeType, {
        forbidOverwrite: true,
      });
      return { url: uploadedUrl };
    } catch (error) {
      if (this.isObjectAlreadyExistsError(error)) {
        return { url };
      }
      throw error;
    }
  }

  /**
   * 生成编辑器图片直传 OSS 的 STS 凭证与上传参数
   */
  async createEditorImageDirectUploadSession(
    fileSize: number,
    _originalName: string,
    mimeType: string,
    contentHash: string,
    userId: string,
  ): Promise<EditorImageDirectUploadSession> {
    if (!this.ossService.isDirectUploadEnabled()) {
      throw new ServiceUnavailableException(
        '未配置 OSS_STS_ROLE_ARN，当前环境不支持前端直传 OSS，请联系管理员配置 STS 角色',
      );
    }

    if (!EDITOR_IMAGE_ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestException('仅支持 JPEG、PNG、GIF、WebP、SVG 格式的图片');
    }

    if (fileSize > EDITOR_IMAGE_MAX_BYTES) {
      throw new BadRequestException('图片大小不能超过 10MB');
    }

    if (!SHA256_HEX_REGEX.test(contentHash)) {
      throw new BadRequestException('contentHash 格式无效，必须是 64 位小写十六进制 sha256');
    }

    const objectKey = this.buildEditorImageObjectKey(userId, contentHash);
    const url = this.ossService.buildPublicObjectUrl(objectKey);
    const exists = await this.ossService.objectExists(objectKey);
    if (exists) {
      return {
        alreadyExists: true,
        objectKey,
        url,
      };
    }

    const credential = await this.ossService.createEditorImageDirectUploadCredential(userId, objectKey);
    return {
      alreadyExists: false,
      ...credential,
    };
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

  // ==================== 头像上传（OSS） ====================

  /**
   * 上传头像至阿里云 OSS，返回公网可访问 URL
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
    if (!this.ossService.isEnabled()) {
      throw new ServiceUnavailableException(
        '未配置阿里云 OSS，请在服务端环境变量中填写 OSS_REGION、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET',
      );
    }

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException('仅支持 JPEG, PNG, GIF, WebP 格式的图片');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new BadRequestException('图片文件大小不能超过 10MB');
    }

    const ext = this.resolveImageExtension(originalName, mimeType);
    const dateDir = new Date().toISOString().split('T')[0];
    const objectKey = `avatars/${userId}/${dateDir}/${nanoid()}${ext}`;

    const url = await this.ossService.uploadBuffer(objectKey, fileBuffer, mimeType);

    // Update user avatar in database
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { avatar_url: url },
    });

    return {
      success: true,
      url,
      fileName: path.basename(objectKey),
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

  private calculateBufferHash(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  private calculateBufferSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private buildEditorImageObjectKey(userId: string, contentHash: string): string {
    const safeUserId = userId.trim();
    return `editor-images/${safeUserId}/sha256/${contentHash}`;
  }

  private isObjectAlreadyExistsError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybe = error as {
      status?: unknown;
      code?: unknown;
      name?: unknown;
      message?: unknown;
    };
    const message = typeof maybe.message === 'string' ? maybe.message : '';
    return (
      maybe.status === 409 ||
      maybe.code === 'FileAlreadyExists' ||
      maybe.name === 'FileAlreadyExistsError' ||
      message.includes('FileAlreadyExists') ||
      message.includes('forbid-overwrite')
    );
  }

  private toPublicUploadUrl(filePath: string): string {
    const relativePath = path.relative(this.uploadDir, filePath);
    if (!relativePath || relativePath.startsWith('..')) {
      return `/uploads/files/${path.basename(filePath)}`;
    }
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }
}
