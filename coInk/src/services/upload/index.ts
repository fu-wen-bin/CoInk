import CryptoJS from 'crypto-js';

import type {
  FileExistsResponse,
  ChunkUploadResponse,
  ChunkInfoResponse,
  CompleteUploadResponse,
  UploadProgressInfo,
  UploadImageData,
  UploadFileWithResumeOptions,
  UploadFileWithResumeResult,
} from './types';

import request, { ErrorHandler } from '@/services/request';
import { calculateChunkCount, generateFileId, getChunkRange } from '@/utils/file-system/upload';

const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;
const HASH_CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * 上传服务类
 */
export class UploadService {
  private baseUrl = '/upload';

  private resolveUploadedUrl(payload: UploadImageData | CompleteUploadResponse | null | undefined) {
    if (!payload) return null;
    if (typeof payload.url === 'string' && payload.url) return payload.url;
    if (typeof payload.fileUrl === 'string' && payload.fileUrl) return payload.fileUrl;
    return null;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new DOMException('请求已取消', 'AbortError');
    }
  }

  private toWordArray(buffer: ArrayBuffer): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.create(buffer as unknown as number[]);
  }

  private async calculateMd5(blob: Blob, signal?: AbortSignal): Promise<string> {
    const md5 = CryptoJS.algo.MD5.create();
    const totalChunks = Math.ceil(blob.size / HASH_CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      this.throwIfAborted(signal);
      const start = chunkIndex * HASH_CHUNK_SIZE;
      const end = Math.min(start + HASH_CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);
      const buffer = await chunk.arrayBuffer();
      md5.update(this.toWordArray(buffer));
    }

    return md5.finalize().toString(CryptoJS.enc.Hex);
  }

  private calculateUploadedBytes(
    uploadedChunks: Set<number>,
    totalSize: number,
    chunkSize: number,
    totalChunks: number,
  ): number {
    if (uploadedChunks.size === 0) return 0;

    let bytes = 0;
    const lastChunkSize = totalSize - (totalChunks - 1) * chunkSize;

    for (const chunkIndex of uploadedChunks) {
      bytes += chunkIndex === totalChunks - 1 ? lastChunkSize : chunkSize;
    }

    return Math.min(bytes, totalSize);
  }

  private emitProgress(
    options: UploadFileWithResumeOptions | undefined,
    chunkNumber: number,
    totalChunks: number,
    bytesUploaded: number,
    totalBytes: number,
  ) {
    if (!options?.onProgress) return;
    const percentage = totalBytes === 0 ? 0 : Math.min(100, Math.round((bytesUploaded / totalBytes) * 100));
    options.onProgress({
      chunkNumber,
      totalChunks,
      bytesUploaded,
      totalBytes,
      percentage,
    });
  }

  /**
   * 检查文件是否已存在（基于文件哈希）
   */
  async checkFileExists(fileHash: string, errorHandler?: ErrorHandler): Promise<FileExistsResponse> {
    const result = await request.get<FileExistsResponse>(`${this.baseUrl}/check-file`, {
      params: { fileHash },
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('检查文件存在性时出错:', error);
        }),
    });

    return result.data?.data || { exists: false };
  }

  /**
   * 获取分片状态
   */
  async getChunkInfo(fileId: string, errorHandler?: ErrorHandler): Promise<ChunkInfoResponse> {
    const result = await request.get<ChunkInfoResponse>(`${this.baseUrl}/chunk-info/${fileId}`, {
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('获取分片信息时出错:', error);
        }),
    });

    return result.data?.data || { fileId, uploadedChunks: [], totalChunks: 0, isComplete: false };
  }

  /**
   * 获取已上传分片索引（兼容旧调用）
   */
  async getUploadedChunks(fileId: string, errorHandler?: ErrorHandler): Promise<number[]> {
    const info = await this.getChunkInfo(fileId, errorHandler);
    return info.uploadedChunks || [];
  }

  /**
   * 上传单个分片
   */
  async uploadChunk(
    chunk: Blob,
    fileId: string,
    chunkNumber: number,
    totalChunks: number,
    _fileName: string,
    totalSize: number,
    mimeType: string,
    fileHash: string,
    chunkSize: number,
    onProgress?: (progress: UploadProgressInfo) => void,
    errorHandler?: ErrorHandler,
    signal?: AbortSignal,
    chunkHash?: string,
  ): Promise<ChunkUploadResponse> {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('fileId', fileId);
    formData.append('chunkIndex', chunkNumber.toString());
    formData.append('chunkNumber', chunkNumber.toString()); // 兼容旧字段
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileHash', fileHash);
    if (chunkHash) {
      formData.append('chunkHash', chunkHash);
    }

    const result = await request.post<ChunkUploadResponse>(`${this.baseUrl}/chunk`, {
      params: formData,
      timeout: 60000,
      retries: 2,
      signal,
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error(`上传分片 ${chunkNumber} 失败:`, error);
        }),
    });

    if (result.error) {
      return { success: false, uploadedChunks: [], isComplete: false };
    }

    const response = result.data?.data || {
      success: true,
      uploadedChunks: [chunkNumber],
      isComplete: false,
    };

    if (onProgress) {
      const bytesUploaded = Math.min((chunkNumber + 1) * chunkSize, totalSize);
      onProgress({
        chunkNumber,
        totalChunks,
        bytesUploaded,
        totalBytes: totalSize,
        percentage: Math.min(100, Math.round((bytesUploaded / totalSize) * 100)),
      });
    }

    return response;
  }

  /**
   * 完成文件上传（合并分片）
   */
  async completeUpload(
    fileId: string,
    fileName: string,
    totalChunks: number,
    fileHash: string,
    totalSize: number,
    mimeType: string,
    errorHandler?: ErrorHandler,
  ): Promise<{ success: boolean; fileUrl: string; url?: string; message: string }> {
    const result = await request.post<CompleteUploadResponse>(`${this.baseUrl}/complete-file`, {
      params: {
        fileId,
        fileName,
        totalChunks,
        fileHash,
        fileSize: totalSize,
        totalSize, // 兼容旧字段
        mimeType: mimeType || 'application/octet-stream',
      },
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('完成文件上传时出错:', error);
        }),
    });

    if (result.error || !result.data?.data) {
      return { success: false, fileUrl: '', message: result.error || '完成上传失败' };
    }

    const payload = result.data.data;
    const url = this.resolveUploadedUrl(payload);
    if (!url) {
      return { success: false, fileUrl: '', message: '未获取到上传地址' };
    }

    return {
      success: true,
      fileUrl: url,
      url,
      message: '上传成功',
    };
  }

  /**
   * 分片上传 + 断点续传
   */
  async uploadFileWithResume(
    file: File,
    options?: UploadFileWithResumeOptions,
    errorHandler?: ErrorHandler,
  ): Promise<UploadFileWithResumeResult> {
    const chunkSize = options?.chunkSize || DEFAULT_CHUNK_SIZE;
    this.throwIfAborted(options?.signal);

    const fileHash = await this.calculateMd5(file, options?.signal);
    this.throwIfAborted(options?.signal);

    const existsResult = await this.checkFileExists(fileHash, errorHandler);
    const fastUploadUrl = this.resolveUploadedUrl(existsResult);
    if (existsResult.exists && fastUploadUrl) {
      return {
        success: true,
        fileId: existsResult.fileId || generateFileId(fileHash),
        fileHash,
        url: fastUploadUrl,
        fromFastUpload: true,
      };
    }

    const fileId = options?.fileId || generateFileId(fileHash);
    const totalChunks = calculateChunkCount(file.size, chunkSize);
    const chunkInfo = await this.getChunkInfo(fileId, errorHandler);
    const uploadedChunks = new Set(
      (chunkInfo.uploadedChunks || []).filter((index) => Number.isInteger(index) && index >= 0),
    );

    const initialBytesUploaded = this.calculateUploadedBytes(uploadedChunks, file.size, chunkSize, totalChunks);
    this.emitProgress(options, uploadedChunks.size, totalChunks, initialBytesUploaded, file.size);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (uploadedChunks.has(chunkIndex)) {
        continue;
      }

      this.throwIfAborted(options?.signal);

      const { start, end, size } = getChunkRange(chunkIndex, chunkSize, file.size);
      const chunkBlob = file.slice(start, end);
      const chunkHash = await this.calculateMd5(chunkBlob, options?.signal);

      const response = await this.uploadChunk(
        chunkBlob,
        fileId,
        chunkIndex,
        totalChunks,
        file.name,
        file.size,
        file.type,
        fileHash,
        size,
        undefined,
        errorHandler,
        options?.signal,
        chunkHash,
      );

      if (!response.success) {
        throw new Error(`分片 ${chunkIndex} 上传失败`);
      }

      uploadedChunks.add(chunkIndex);
      const uploadedBytes = this.calculateUploadedBytes(uploadedChunks, file.size, chunkSize, totalChunks);
      this.emitProgress(options, chunkIndex + 1, totalChunks, uploadedBytes, file.size);
      options?.onChunkUploaded?.(chunkIndex, [...uploadedChunks].sort((a, b) => a - b));
    }

    this.throwIfAborted(options?.signal);

    const completeResult = await this.completeUpload(
      fileId,
      file.name,
      totalChunks,
      fileHash,
      file.size,
      file.type,
      errorHandler,
    );

    if (!completeResult.success || !completeResult.fileUrl) {
      throw new Error(completeResult.message || '文件合并失败');
    }

    return {
      success: true,
      fileId,
      fileHash,
      url: completeResult.fileUrl,
      fromFastUpload: false,
    };
  }

  /**
   * 取消上传
   */
  async cancelUpload(fileId: string, errorHandler?: ErrorHandler): Promise<boolean> {
    const result = await request.delete<{ success: boolean }>(`${this.baseUrl}/cancel/${fileId}`, {
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('取消上传时出错:', error);
        }),
    });

    return result.data?.data?.success || false;
  }

  /**
   * 获取上传状态
   */
  async getUploadStatus(fileId: string, errorHandler?: ErrorHandler): Promise<ChunkInfoResponse> {
    const result = await request.get<ChunkInfoResponse>(`${this.baseUrl}/status/${fileId}`, {
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('获取上传状态时出错:', error);
        }),
    });

    return result.data?.data || { fileId, uploadedChunks: [], totalChunks: 0, isComplete: false };
  }

  /**
   * 上传头像
   */
  async uploadAvatar(file: File, errorHandler?: ErrorHandler): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);

    const result = await request.post<UploadImageData>(`${this.baseUrl}/avatar`, {
      params: formData,
      timeout: 30000,
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('图片上传时出错:', error);
        }),
    });

    const uploadedUrl = this.resolveUploadedUrl(result.data?.data);
    if (result.error || !uploadedUrl) {
      throw new Error(result.error || '图片上传失败');
    }

    return uploadedUrl;
  }

  /**
   * 上传编辑器图片
   */
  async uploadEditorImage(file: File, errorHandler?: ErrorHandler): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const result = await request.post<UploadImageData>(`${this.baseUrl}/editor-image`, {
      params: formData,
      timeout: 30000,
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('编辑器图片上传时出错:', error);
        }),
    });

    const uploadedUrl = this.resolveUploadedUrl(result.data?.data);
    if (result.error || !uploadedUrl) {
      throw new Error(result.error || '图片上传失败');
    }

    return uploadedUrl;
  }

  /**
   * 兼容旧调用：等价于 uploadEditorImage
   */
  async uploadImage(file: File, errorHandler?: ErrorHandler): Promise<string> {
    return this.uploadEditorImage(file, errorHandler);
  }
}

// 创建单例实例
export const uploadService = new UploadService();

// 导出默认实例
export default uploadService;

// 导出所有类型
export * from './types';
