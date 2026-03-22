/**
 * 编辑器图片：通过 Nest 上传至阿里云 OSS（multipart/form-data + Cookie JWT）。
 * 与 Base64 方案并存，由 NEXT_PUBLIC_EDITOR_IMAGE_UPLOAD_MODE 切换。
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getServerBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '');
}

export function isEditorImageOssModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EDITOR_IMAGE_UPLOAD_MODE === 'oss';
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
    throw new Error(`文件大小超出最大允许值(${MAX_IMAGE_BYTES / (1024 * 1024)}MB)`);
  }

  const endpoint = `${base}/upload/editor-image`;

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

export { MAX_IMAGE_BYTES };
