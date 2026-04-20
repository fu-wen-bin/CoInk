/**
 * 编辑器图片：优先直传阿里云 OSS（STS + multipartUpload + 实时进度），失败时回退到 Nest 代理上传。
 * 与 Base64 方案并存，由 NEXT_PUBLIC_EDITOR_IMAGE_UPLOAD_MODE 切换。
 */

import { formatFileSize } from '@/utils/format/file-size';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type EditorImageDirectUploadSessionReady = {
  alreadyExists?: false;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
  region: string;
  bucket: string;
  endpoint?: string;
  authorizationV4: boolean;
  partSize: number;
  parallel: number;
  objectKey: string;
  url: string;
};

type EditorImageDirectUploadSessionHit = {
  alreadyExists: true;
  objectKey: string;
  url: string;
};

type EditorImageDirectUploadSession = EditorImageDirectUploadSessionReady | EditorImageDirectUploadSessionHit;
type EditorImageDirectUploadSessionPayload = Partial<EditorImageDirectUploadSessionReady> &
  Partial<EditorImageDirectUploadSessionHit> & {
    alreadyExists?: boolean;
  };

/** 编辑器图片单文件上限的展示文案（与校验字节数一致，避免各处手写「10MB」不一致） */
export function formatEditorImageMaxLabel(bytes: number = MAX_IMAGE_BYTES): string {
  return formatFileSize(bytes);
}

function getServerBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '');
}

export function isEditorImageOssModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EDITOR_IMAGE_UPLOAD_MODE === 'oss';
}

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'AbortError' ||
    error.message.includes('上传取消') ||
    error.message.includes('abort') ||
    error.message.includes('cancel')
  );
}

function isObjectAlreadyExistsError(error: unknown): boolean {
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

async function calculateSha256Hex(file: File): Promise<string | null> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
    return null;
  }
  try {
    const buffer = await file.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

async function requestDirectUploadSession(
  base: string,
  file: File,
  contentHash: string,
): Promise<EditorImageDirectUploadSession> {
  const response = await fetch(`${base}/upload/editor-image/sts`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      contentHash,
    }),
  });

  const raw = (await response.json().catch(() => null)) as {
    code?: number | string;
    message?: string;
    data?: EditorImageDirectUploadSessionPayload;
  } | null;
  const data = raw?.data;

  if (!response.ok || !data?.objectKey || !data.url) {
    const message =
      typeof raw?.message === 'string' && raw.message.trim().length > 0
        ? raw.message
        : `获取 OSS 直传凭证失败 (${response.status})`;
    throw new Error(message);
  }

  if (data.alreadyExists === true) {
    return {
      alreadyExists: true,
      objectKey: data.objectKey,
      url: data.url,
    };
  }

  if (
    !data.accessKeyId ||
    !data.accessKeySecret ||
    !data.securityToken ||
    !data.bucket ||
    !data.region ||
    !data.objectKey ||
    !data.url
  ) {
    const message =
      typeof raw?.message === 'string' && raw.message.trim().length > 0
        ? raw.message
        : `获取 OSS 直传凭证失败 (${response.status})`;
    throw new Error(message);
  }

  return {
    alreadyExists: false,
    accessKeyId: data.accessKeyId,
    accessKeySecret: data.accessKeySecret,
    securityToken: data.securityToken,
    expiration: typeof data.expiration === 'string' ? data.expiration : '',
    region: data.region,
    bucket: data.bucket,
    endpoint: typeof data.endpoint === 'string' && data.endpoint.trim() ? data.endpoint : undefined,
    authorizationV4: data.authorizationV4 !== false,
    partSize:
      typeof data.partSize === 'number' && Number.isFinite(data.partSize)
        ? data.partSize
        : 512 * 1024,
    parallel:
      typeof data.parallel === 'number' && Number.isFinite(data.parallel) ? data.parallel : 3,
    objectKey: data.objectKey,
    url: data.url,
  };
}

async function uploadEditorImageViaBackendProxy(
  endpoint: string,
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.({ progress });
      }
    };

    const onAbort = () => {
      xhr.abort();
    };
    abortSignal?.addEventListener('abort', onAbort);

    xhr.onload = () => {
      try {
        const raw = JSON.parse(xhr.responseText) as {
          code?: number | string;
          message?: string;
          data?: { url?: string };
        };

        if (xhr.status >= 200 && xhr.status < 300 && raw.data?.url) {
          resolve(raw.data.url);
          return;
        }

        const msg =
          typeof raw.message === 'string' && raw.message.length > 0
            ? raw.message
            : `上传失败 (${xhr.status})`;
        reject(new Error(msg));
      } catch {
        reject(new Error('上传响应解析失败'));
      }
    };

    xhr.onerror = () => reject(new Error('网络错误，上传失败'));
    xhr.onabort = () => reject(new Error('上传取消'));

    xhr.onloadend = () => {
      abortSignal?.removeEventListener('abort', onAbort);
    };

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

/**
 * 上传图片到后端 OSS 接口，返回可访问 URL。
 * 使用 XMLHttpRequest 以支持上传进度与 AbortSignal。
 */
export async function uploadEditorImageToOss(
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  const base = getServerBaseUrl();
  if (!base) {
    throw new Error('未配置 NEXT_PUBLIC_SERVER_URL，无法上传图片');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`文件大小超出最大允许值（${formatEditorImageMaxLabel(MAX_IMAGE_BYTES)}）`);
  }

  if (abortSignal?.aborted) {
    throw new Error('上传取消');
  }

  const fallbackEndpoint = `${base}/upload/editor-image`;
  const contentHash = await calculateSha256Hex(file);
  if (!contentHash) {
    return uploadEditorImageViaBackendProxy(fallbackEndpoint, file, onProgress, abortSignal);
  }

  try {
    const session = await requestDirectUploadSession(base, file, contentHash);
    if (session.alreadyExists) {
      onProgress?.({ progress: 100 });
      return session.url;
    }
    const OSSModule = await import('ali-oss');
    const OSS = OSSModule.default;

    const client = new OSS({
      region: session.region,
      bucket: session.bucket,
      accessKeyId: session.accessKeyId,
      accessKeySecret: session.accessKeySecret,
      stsToken: session.securityToken,
      authorizationV4: session.authorizationV4,
      ...(session.endpoint ? { endpoint: session.endpoint } : {}),
    }) as {
      multipartUpload: (
        name: string,
        fileData: File,
        options?: {
          partSize?: number;
          parallel?: number;
          progress?: (percentage: number, checkpoint: unknown, response: unknown) => Promise<void>;
          headers?: Record<string, string>;
        },
      ) => Promise<unknown>;
      cancel?: () => void;
    };

    const onAbort = () => {
      try {
        client.cancel?.();
      } catch {
        // Ignore cancel errors from SDK internals.
      }
    };
    abortSignal?.addEventListener('abort', onAbort);

    try {
      onProgress?.({ progress: 0 });
      try {
        await client.multipartUpload(session.objectKey, file, {
          partSize: session.partSize,
          parallel: session.parallel,
          headers: {
            'x-oss-forbid-overwrite': 'true',
          },
          progress: async (percentage) => {
            if (abortSignal?.aborted) {
              throw new Error('上传取消');
            }
            const progress = Math.min(99, Math.max(0, Math.round(percentage * 100)));
            onProgress?.({ progress });
          },
        });
      } catch (error) {
        if (abortSignal?.aborted || isAbortLikeError(error)) {
          throw new Error('上传取消');
        }
        if (isObjectAlreadyExistsError(error)) {
          onProgress?.({ progress: 100 });
          return session.url;
        }
        throw error;
      }
      onProgress?.({ progress: 100 });
      return session.url;
    } finally {
      abortSignal?.removeEventListener('abort', onAbort);
    }
  } catch (error) {
    if (abortSignal?.aborted || isAbortLikeError(error)) {
      throw new Error('上传取消');
    }
    return uploadEditorImageViaBackendProxy(fallbackEndpoint, file, onProgress, abortSignal);
  }
}
