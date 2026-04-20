declare module 'ali-oss' {
  export type MultipartUploadProgress = (
    percentage: number,
    checkpoint?: unknown,
    response?: unknown,
  ) => Promise<void> | void;

  export type MultipartUploadOptions = {
    partSize?: number;
    parallel?: number;
    progress?: MultipartUploadProgress;
  };

  export default class OSS {
    constructor(options: Record<string, unknown>);
    multipartUpload(
      objectName: string,
      file: File | Blob,
      options?: MultipartUploadOptions,
    ): Promise<unknown>;
    cancel(): void;
  }
}
