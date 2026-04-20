/**
 * 文件存在性检查响应
 */
export interface FileExistsResponse {
  exists: boolean;
  fileId?: string;
  filePath?: string;
  fileName?: string;
  url?: string;
  fileUrl?: string;
}

/**
 * 分片上传响应
 */
export interface ChunkUploadResponse {
  success: boolean;
  uploadedChunks: number[];
  isComplete: boolean;
}

/**
 * 分片信息响应
 */
export interface ChunkInfoResponse {
  fileId: string;
  uploadedChunks: number[];
  totalChunks: number;
  isComplete: boolean;
}

/**
 * 完成上传响应
 */
export interface CompleteUploadResponse {
  success: boolean;
  fileId: string;
  filePath: string;
  url?: string;
  fileUrl?: string;
}

/**
 * 上传进度信息
 */
export interface UploadProgressInfo {
  chunkNumber: number;
  totalChunks: number;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

/**
 * 断点续传参数
 */
export interface UploadFileWithResumeOptions {
  chunkSize?: number;
  fileId?: string;
  onProgress?: (progress: UploadProgressInfo) => void;
  onChunkUploaded?: (chunkIndex: number, uploadedChunks: number[]) => void;
  signal?: AbortSignal;
}

/**
 * 断点续传结果
 */
export interface UploadFileWithResumeResult {
  success: boolean;
  fileId: string;
  fileHash: string;
  url: string;
  fromFastUpload: boolean;
}

/**
 * 图片上传返回的 data 结构
 */
export interface UploadImageData {
  /** 新接口（OSS）返回字段 */
  url?: string;
  /** 旧接口兼容字段 */
  fileUrl?: string;
  fileHash?: string;
  processedFileName?: string;
  originalMimeType?: string;
  processedMimeType?: string;
  imageKitFileId?: string;
  success?: boolean;
  fileName?: string;
}
