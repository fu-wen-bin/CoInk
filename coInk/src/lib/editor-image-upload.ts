/**
 * 双链路图片上传（OSS 直传 + 本地分片）统一入口。
 * - OSS：STS + multipart + checkpoint 持久化 + 自动恢复
 * - 本地：check-file/chunk-info/chunk/complete-file 分片续传 + 自动恢复
 */

import { uploadService } from '@/services/upload';
import { formatFileSize } from '@/utils/format/file-size';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const RETRY_MAX_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 1000;
const CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000;
const CHECKPOINT_STORAGE_PREFIX = 'coink:oss-upload-checkpoint:v1:';

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

type UploadMode = 'oss' | 'local';

export type UploadStatusPhase =
  | 'uploading'
  | 'paused_offline'
  | 'resuming'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface UploadStatusEvent {
  phase: UploadStatusPhase;
  mode: UploadMode;
  attempt?: number;
  message?: string;
}

interface RetryPolicy {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export interface UploadImageResumableOptions {
  onProgress?: (event: { progress: number }) => void;
  onStatus?: (event: UploadStatusEvent) => void;
  signal?: AbortSignal;
  preferOss?: boolean;
  retryPolicy?: RetryPolicy;
}

type UploadExecutor = () => Promise<string>;

type OssMultipartCheckpointRecord = {
  v: 1;
  objectKey: string;
  fingerprint: string;
  checkpoint: unknown;
  updatedAt: number;
  expiresAt: number;
};

/** 编辑器图片单文件上限的展示文案（与校验字节数一致，避免各处手写「10MB」不一致） */
export function formatEditorImageMaxLabel(bytes: number = MAX_IMAGE_BYTES): string {
  return formatFileSize(bytes);
}

function getServerBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '');
}

function getFallbackOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace(/\/$/, '');
}

function toAbsoluteUrl(url: string): string {
  const value = url.trim();
  if (!value) return value;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  const base = getServerBaseUrl() || getFallbackOrigin();
  if (!base) return value;
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value.replace(/^\/+/, '')}`;
}

export function isEditorImageOssModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EDITOR_IMAGE_UPLOAD_MODE === 'oss';
}

function ensureAbortable(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('上传取消', 'AbortError');
  }
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

function isLikelyNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return !isBrowserOnline();
  }
  const maybe = error as {
    message?: unknown;
    code?: unknown;
    name?: unknown;
    status?: unknown;
  };
  const message = typeof maybe.message === 'string' ? maybe.message.toLowerCase() : '';
  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('连接错误') ||
    message.includes('网络连接错误')
  ) {
    return true;
  }
  if (maybe.name === 'TypeError' || maybe.code === 'ECONNABORTED') {
    return true;
  }
  return !isBrowserOnline();
}

function isLikelyStsExpiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { message?: unknown; code?: unknown };
  const message = typeof maybe.message === 'string' ? maybe.message : '';
  const code = typeof maybe.code === 'string' ? maybe.code : '';
  return (
    message.includes('SecurityTokenExpired') ||
    message.includes('security token is expired') ||
    message.includes('InvalidAccessKeyId') ||
    message.includes('SignatureDoesNotMatch') ||
    code === 'SecurityTokenExpired'
  );
}

function isOssUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return (
    message.includes('未配置 OSS_STS_ROLE_ARN') ||
    message.includes('获取 OSS 直传凭证失败 (503)') ||
    message.includes('缺少 OSS_STS_ROLE_ARN') ||
    message.includes('STS 凭证生成失败')
  );
}

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function waitForOnline(signal?: AbortSignal): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isBrowserOnline()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const handleOnline = () => {
      cleanup();
      resolve();
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException('上传取消', 'AbortError'));
    };
    const cleanup = () => {
      window.removeEventListener('online', handleOnline);
      signal?.removeEventListener('abort', handleAbort);
    };

    window.addEventListener('online', handleOnline, { once: true });
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      reject(new DOMException('上传取消', 'AbortError'));
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function emitStatus(
  options: UploadImageResumableOptions | undefined,
  phase: UploadStatusPhase,
  mode: UploadMode,
  payload?: Partial<UploadStatusEvent>,
): void {
  options?.onStatus?.({
    phase,
    mode,
    ...payload,
  });
}

function getRetryOptions(retryPolicy?: RetryPolicy): Required<RetryPolicy> {
  return {
    maxAttempts:
      typeof retryPolicy?.maxAttempts === 'number' && retryPolicy.maxAttempts > 0
        ? retryPolicy.maxAttempts
        : RETRY_MAX_ATTEMPTS,
    baseDelayMs:
      typeof retryPolicy?.baseDelayMs === 'number' && retryPolicy.baseDelayMs > 0
        ? retryPolicy.baseDelayMs
        : RETRY_BASE_DELAY_MS,
  };
}

async function executeWithRetry(
  mode: UploadMode,
  options: UploadImageResumableOptions | undefined,
  executor: UploadExecutor,
  isRetryable: (error: unknown) => boolean,
): Promise<string> {
  const { maxAttempts, baseDelayMs } = getRetryOptions(options?.retryPolicy);
  let attempt = 0;

  while (true) {
    ensureAbortable(options?.signal);
    emitStatus(options, attempt === 0 ? 'uploading' : 'resuming', mode, { attempt: attempt + 1 });

    try {
      const url = await executor();
      emitStatus(options, 'success', mode, { attempt: attempt + 1 });
      return url;
    } catch (error) {
      if (isAbortLikeError(error) || options?.signal?.aborted) {
        emitStatus(options, 'cancelled', mode, { message: '上传已取消' });
        throw new Error('上传取消');
      }

      if (!isRetryable(error) || attempt >= maxAttempts - 1) {
        emitStatus(options, 'failed', mode, {
          attempt: attempt + 1,
          message: error instanceof Error ? error.message : '上传失败',
        });
        throw error instanceof Error ? error : new Error('上传失败');
      }

      emitStatus(options, 'paused_offline', mode, {
        attempt: attempt + 1,
        message: '网络中断，等待恢复后继续上传',
      });

      attempt += 1;
      await waitForOnline(options?.signal);
      await sleep(baseDelayMs * Math.pow(2, attempt - 1), options?.signal);
    }
  }
}

function getCheckpointStorageKey(objectKey: string): string {
  return `${CHECKPOINT_STORAGE_PREFIX}${objectKey}`;
}

function readCheckpointRecord(objectKey: string): OssMultipartCheckpointRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getCheckpointStorageKey(objectKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OssMultipartCheckpointRecord;
    if (parsed.v !== 1 || parsed.objectKey !== objectKey || parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(getCheckpointStorageKey(objectKey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistCheckpointRecord(
  objectKey: string,
  fingerprint: string,
  checkpoint: unknown,
  currentTime: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: OssMultipartCheckpointRecord = {
      v: 1,
      objectKey,
      fingerprint,
      checkpoint,
      updatedAt: currentTime,
      expiresAt: currentTime + CHECKPOINT_TTL_MS,
    };
    window.localStorage.setItem(getCheckpointStorageKey(objectKey), JSON.stringify(payload));
  } catch {
    // ignore write errors
  }
}

function clearCheckpointRecord(objectKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getCheckpointStorageKey(objectKey));
  } catch {
    // ignore remove errors
  }
}

function buildFileFingerprint(file: File, hash: string): string {
  return `${hash}:${file.size}:${file.type}:${file.lastModified}`;
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

async function uploadWithOssResumable(
  file: File,
  contentHash: string,
  options?: UploadImageResumableOptions,
): Promise<string> {
  const base = getServerBaseUrl();
  if (!base) {
    throw new Error('未配置 NEXT_PUBLIC_SERVER_URL，无法使用 OSS 上传');
  }

  let session = await requestDirectUploadSession(base, file, contentHash);
  if (session.alreadyExists) {
    options?.onProgress?.({ progress: 100 });
    return toAbsoluteUrl(session.url);
  }

  const fingerprint = buildFileFingerprint(file, contentHash);

  const runOnce = async (): Promise<string> => {
    ensureAbortable(options?.signal);
    if (session.alreadyExists) {
      options?.onProgress?.({ progress: 100 });
      return toAbsoluteUrl(session.url);
    }
    const readySession = session;

    const OSSModule = await import('ali-oss');
    const OSS = OSSModule.default;
    const client = new OSS({
      region: readySession.region,
      bucket: readySession.bucket,
      accessKeyId: readySession.accessKeyId,
      accessKeySecret: readySession.accessKeySecret,
      stsToken: readySession.securityToken,
      authorizationV4: readySession.authorizationV4,
      ...(readySession.endpoint ? { endpoint: readySession.endpoint } : {}),
    }) as {
      multipartUpload: (
        name: string,
        fileData: File,
        options?: {
          partSize?: number;
          parallel?: number;
          checkpoint?: unknown;
          progress?: (percentage: number, checkpoint: unknown, response: unknown) => Promise<void>;
          headers?: Record<string, string>;
        },
      ) => Promise<unknown>;
      cancel?: () => void;
    };

    const record = readCheckpointRecord(readySession.objectKey);
    const checkpoint =
      record && record.fingerprint === fingerprint && record.expiresAt >= Date.now()
        ? record.checkpoint
        : undefined;
    let lastPersistAt = 0;
    const onAbort = () => {
      try {
        client.cancel?.();
      } catch {
        // ignore sdk cancellation errors
      }
    };
    options?.signal?.addEventListener('abort', onAbort);

    try {
      options?.onProgress?.({ progress: 0 });
      await client.multipartUpload(readySession.objectKey, file, {
        partSize: readySession.partSize,
        parallel: readySession.parallel,
        checkpoint,
        headers: {
          'x-oss-forbid-overwrite': 'true',
        },
        progress: async (percentage, nextCheckpoint) => {
          ensureAbortable(options?.signal);
          const progress = Math.min(99, Math.max(0, Math.round(percentage * 100)));
          options?.onProgress?.({ progress });
          if (nextCheckpoint) {
            const now = Date.now();
            if (now - lastPersistAt > 500) {
              persistCheckpointRecord(readySession.objectKey, fingerprint, nextCheckpoint, now);
              lastPersistAt = now;
            }
          }
        },
      });
      clearCheckpointRecord(readySession.objectKey);
      options?.onProgress?.({ progress: 100 });
      return toAbsoluteUrl(readySession.url);
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
    }
  };

  return executeWithRetry(
    'oss',
    options,
    async () => {
      try {
        return await runOnce();
      } catch (error) {
        if (isObjectAlreadyExistsError(error)) {
          clearCheckpointRecord(session.objectKey);
          options?.onProgress?.({ progress: 100 });
          return toAbsoluteUrl(session.url);
        }
        if (isLikelyStsExpiredError(error)) {
          session = await requestDirectUploadSession(base, file, contentHash);
          if (session.alreadyExists) {
            clearCheckpointRecord(session.objectKey);
            options?.onProgress?.({ progress: 100 });
            return toAbsoluteUrl(session.url);
          }
        }
        throw error;
      }
    },
    (error) => isLikelyNetworkError(error) || isLikelyStsExpiredError(error),
  );
}

async function uploadWithLocalChunkResumable(
  file: File,
  options?: UploadImageResumableOptions,
): Promise<string> {
  return executeWithRetry(
    'local',
    options,
    async () => {
      ensureAbortable(options?.signal);
      const result = await uploadService.uploadFileWithResume(
        file,
        {
          onProgress: (progress) => {
            options?.onProgress?.({ progress: progress.percentage });
          },
          signal: options?.signal,
        },
        (error) => {
          // 抑制默认控制台噪声，错误由调用方统一处理
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[upload-local] chunk error', error);
          }
        },
      );
      options?.onProgress?.({ progress: 100 });
      return toAbsoluteUrl(result.url);
    },
    (error) => isLikelyNetworkError(error),
  );
}

/**
 * 统一图片上传入口：
 * - 默认：有 OSS 直传配置则优先 OSS，否则走本地分片
 * - OSS 不可用时自动回退本地分片
 */
export async function uploadImageResumable(
  file: File,
  options?: UploadImageResumableOptions,
): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`文件大小超出最大允许值（${formatEditorImageMaxLabel(MAX_IMAGE_BYTES)}）`);
  }
  ensureAbortable(options?.signal);

  const tryOss = options?.preferOss ?? isEditorImageOssModeEnabled();
  if (!tryOss) {
    return uploadWithLocalChunkResumable(file, options);
  }

  const contentHash = await calculateSha256Hex(file);
  if (!contentHash) {
    return uploadWithLocalChunkResumable(file, options);
  }

  try {
    return await uploadWithOssResumable(file, contentHash, options);
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw error instanceof Error ? error : new Error('上传取消');
    }
    if (!isOssUnavailableError(error)) {
      throw error instanceof Error ? error : new Error('上传失败');
    }
    return uploadWithLocalChunkResumable(file, options);
  }
}

/**
 * 兼容旧调用：保留名称，内部走统一可续传上传链路（优先 OSS）。
 */
export async function uploadEditorImageToOss(
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal,
  onStatus?: (event: UploadStatusEvent) => void,
): Promise<string> {
  return uploadImageResumable(file, {
    onProgress,
    onStatus,
    signal: abortSignal,
    preferOss: true,
  });
}
