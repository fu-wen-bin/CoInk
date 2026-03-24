import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';

/** 仅使用 put，避免 ali-oss 类型包不完整带来的 ESLint 噪声 */
type OssPutClient = {
  put: (
    name: string,
    file: Buffer,
    options?: { headers?: Record<string, string> },
  ) => Promise<{ url?: string }>;
};

/**
 * 阿里云 OSS 封装：仅在环境变量完整配置时可用。
 * 公网访问 URL 可使用 SDK 返回的 url，或通过 OSS_PUBLIC_BASE_URL 指定 CDN 域名前缀。
 */
@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private client: OssPutClient | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * 是否已配置 OSS（四项必填：region、accessKeyId、accessKeySecret、bucket）
   */
  isEnabled(): boolean {
    const region = this.config.get<string>('OSS_REGION')?.trim();
    const accessKeyId = this.config.get<string>('OSS_ACCESS_KEY_ID')?.trim();
    const accessKeySecret = this.config.get<string>('OSS_ACCESS_KEY_SECRET')?.trim();
    const bucket = this.config.get<string>('OSS_BUCKET')?.trim();
    return Boolean(region && accessKeyId && accessKeySecret && bucket);
  }

  private getClient(): OssPutClient {
    if (this.client) {
      return this.client;
    }

    const region = this.config.get<string>('OSS_REGION')?.trim();
    const accessKeyId = this.config.get<string>('OSS_ACCESS_KEY_ID')?.trim();
    const accessKeySecret = this.config.get<string>('OSS_ACCESS_KEY_SECRET')?.trim();
    const bucket = this.config.get<string>('OSS_BUCKET')?.trim();

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      throw new Error('OSS 环境变量未完整配置');
    }

    const endpoint = this.config.get<string>('OSS_ENDPOINT')?.trim();

    // ali-oss 默认导出类型在部分 TS 版本下推断为 error

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    this.client = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
      ...(endpoint ? { endpoint } : {}),
    }) as OssPutClient;
    return this.client;
  }

  /**
   * 上传 Buffer 到 OSS，返回可直接在编辑器中使用的公网 URL
   */
  async uploadBuffer(objectKey: string, buffer: Buffer, contentType: string): Promise<string> {
    const client = this.getClient();
    const result = await client.put(objectKey, buffer, {
      headers: {
        'Content-Type': contentType,
      },
    });

    const publicBase = this.config.get<string>('OSS_PUBLIC_BASE_URL')?.trim();
    if (publicBase) {
      const base = publicBase.replace(/\/$/, '');
      const key = objectKey.replace(/^\//, '');
      return `${base}/${key}`;
    }

    if (typeof result.url === 'string' && result.url.length > 0) {
      return result.url;
    }

    this.logger.error('OSS put 成功但未返回 url，请检查 bucket 与 endpoint 配置');
    throw new Error('OSS 上传成功但未获得访问地址');
  }

  /**
   * 从 OSS 删除文件
   */
  async deleteFile(objectKey: string): Promise<void> {
    const client = this.getClient();
    // ali-oss delete 方法不在我们定义的简化类型中，使用 any 绕过类型检查

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    await (client as any).delete(objectKey);
  }
}
