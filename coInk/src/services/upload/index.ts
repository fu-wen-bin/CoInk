import type {
  FileExistsResponse,
  ChunkUploadResponse,
  ChunkInfoResponse,
  CompleteUploadResponse,
  UploadProgressInfo,
  UploadImageData,
} from './types';

import request, { ErrorHandler } from '@/services/request';

/**
 * 上传服务类
 */
export class UploadService {
  private baseUrl = '/upload';

  private resolveUploadedUrl(payload: UploadImageData | null | undefined): string | null {
    if (!payload) return null;
    if (typeof payload.url === 'string' && payload.url) return payload.url;
    if (typeof payload.fileUrl === 'string' && payload.fileUrl) return payload.fileUrl;
    return null;
  }

  /**
   * 检查文件是否已存在（基于文件哈希）
   */
  async checkFileExists(fileHash: string, errorHandler?: ErrorHandler) {
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
   * 获取已上传的分块信息
   */
  async getUploadedChunks(fileId: string, errorHandler?: ErrorHandler) {
    const result = await request.get<ChunkInfoResponse>(`${this.baseUrl}/chunk-info/${fileId}`, {
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('获取已上传分块信息时出错:', error);
        }),
    });

    return result.data?.data?.uploadedChunks || [];
  }

  /**
   * 上传单个分块
   */
  async uploadChunk(
    chunk: Blob,
    fileId: string,
    chunkNumber: number,
    totalChunks: number,
    fileName: string,
    totalSize: number,
    mimeType: string,
    fileHash: string,
    chunkSize: number,
    onProgress?: (progress: UploadProgressInfo) => void,
    errorHandler?: ErrorHandler,
  ) {
    const formData = new FormData();

    formData.append('file', chunk);
    formData.append('fileId', fileId);
    formData.append('fileName', fileName);
    formData.append('totalSize', totalSize.toString());
    formData.append('mimeType', mimeType || 'application/octet-stream');
    formData.append('chunkNumber', chunkNumber.toString());
    formData.append('chunkSize', chunkSize.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileHash', fileHash);

    console.log('上传参数:', {
      fileId,
      fileName,
      totalSize,
      mimeType,
      chunkNumber,
      chunkSize,
      totalChunks,
      fileHash,
    });

    const result = await request.post<ChunkUploadResponse>(`${this.baseUrl}/chunk`, {
      params: formData,
      timeout: 60000,
      retries: 2,
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error(`上传分块 ${chunkNumber} 失败:`, error);
        }),
    });

    // 触发进度回调
    if (onProgress) {
      const bytesUploaded = (chunkNumber + 1) * chunkSize;
      onProgress({
        chunkNumber,
        totalChunks,
        bytesUploaded: Math.min(bytesUploaded, totalSize),
        totalBytes: totalSize,
      });
    }

    if (result.error) {
      console.error('上传响应错误:', result.error);

      return { success: false, message: result.error };
    }

    return result.data?.data || { success: true, message: '上传成功' };
  }

  /**
   * 完成文件上传（合并分块）
   */
  async completeUpload(
    fileId: string,
    fileName: string,
    totalChunks: number,
    fileHash: string,
    totalSize: number,
    mimeType: string,
    errorHandler?: ErrorHandler,
  ) {
    const result = await request.post<CompleteUploadResponse>(`${this.baseUrl}/complete-file`, {
      params: {
        fileId,
        fileName,
        totalChunks,
        fileHash,
        totalSize,
        mimeType,
      },
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('完成文件上传时出错:', error);
        }),
    });

    return (
      result.data?.data || { success: false, fileUrl: '', message: result.error || '完成上传失败' }
    );
  }

  /**
   * 取消上传
   */
  async cancelUpload(fileId: string, errorHandler?: ErrorHandler) {
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
  async getUploadStatus(fileId: string, errorHandler?: ErrorHandler) {
    const result = await request.get<ChunkInfoResponse>(`${this.baseUrl}/status/${fileId}`, {
      errorHandler:
        errorHandler ||
        ((error) => {
          console.error('获取上传状态时出错:', error);
        }),
    });

    return result.data?.data || { uploadedChunks: [], totalChunks: 0, isComplete: false };
  }

  /**
   * 上传头像
   * @param file 要上传的头像文件
   * @returns 头像URL字符串
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
   * @param file 要上传的图片文件
   * @returns 图片URL字符串
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
