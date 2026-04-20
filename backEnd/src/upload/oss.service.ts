import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';

/** 仅使用 put，避免 ali-oss 类型包不完整带来的 ESLint 噪声 */
type OssClient = {
  put: (
    name: string,
    file: Buffer,
    options?: { headers?: Record<string, string> },
  ) => Promise<{ url?: string }>;
  head?: (name: string) => Promise<unknown>;
  delete?: (name: string) => Promise<unknown>;
};

type UploadBufferOptions = {
  forbidOverwrite?: boolean;
};

export type EditorImageDirectUploadCredential = {
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

/**
 * 阿里云 OSS 封装：仅在环境变量完整配置时可用。
 * 公网访问 URL 可使用 SDK 返回的 url，或通过 OSS_PUBLIC_BASE_URL 指定 CDN 域名前缀。
 */
@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private client: OssClient | null = null;

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

  /**
   * 前端直传是否可用（除 OSS 基础配置外，还需要 STS 角色 ARN）
   */
  isDirectUploadEnabled(): boolean {
    const roleArn = this.config.get<string>('OSS_STS_ROLE_ARN')?.trim();
    return this.isEnabled() && Boolean(roleArn);
  }

  private getClient(): OssClient {
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
    }) as OssClient;
    return this.client;
  }

  /**
   * 上传 Buffer 到 OSS，返回可直接在编辑器中使用的公网 URL
   */
  async uploadBuffer(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
    options?: UploadBufferOptions,
  ): Promise<string> {
    const client = this.getClient();
    const objectAcl = this.config.get<string>('OSS_OBJECT_ACL')?.trim() || 'public-read';
    const result = await client.put(objectKey, buffer, {
      headers: {
        'Content-Type': contentType,
        'x-oss-object-acl': objectAcl,
        ...(options?.forbidOverwrite ? { 'x-oss-forbid-overwrite': 'true' } : {}),
      },
    });

    const publicBase = this.config.get<string>('OSS_PUBLIC_BASE_URL')?.trim();
    if (publicBase) {
      return this.buildPublicObjectUrl(objectKey);
    }

    if (typeof result.url === 'string' && result.url.length > 0) {
      return result.url;
    }

    this.logger.error('OSS put 成功但未返回 url，请检查 bucket 与 endpoint 配置');
    throw new Error('OSS 上传成功但未获得访问地址');
  }

  async objectExists(objectKey: string): Promise<boolean> {
    const client = this.getClient();
    const head = client.head;
    if (!head) {
      throw new Error('当前 OSS 客户端不支持 head 操作');
    }

    try {
      await head.call(client, objectKey);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 为“编辑器图片直传 OSS”生成 STS 临时凭证与上传配置
   */
  async createEditorImageDirectUploadCredential(
    userId: string,
    objectKey: string,
  ): Promise<EditorImageDirectUploadCredential> {
    const roleArn = this.config.get<string>('OSS_STS_ROLE_ARN')?.trim();
    if (!roleArn) {
      throw new Error('缺少 OSS_STS_ROLE_ARN，无法下发直传凭证');
    }

    const region = this.getRequiredEnv('OSS_REGION');
    const bucket = this.getRequiredEnv('OSS_BUCKET');
    const accessKeyId = this.getRequiredEnv('OSS_ACCESS_KEY_ID');
    const accessKeySecret = this.getRequiredEnv('OSS_ACCESS_KEY_SECRET');
    const sessionPrefix =
      this.config.get<string>('OSS_STS_SESSION_NAME_PREFIX')?.trim() || 'coink-editor-upload';
    const roleSessionName = this.buildRoleSessionName(sessionPrefix, userId);
    const durationSeconds = this.readIntEnv('OSS_STS_DURATION_SECONDS', 900, 900, 3600);
    const externalId = this.config.get<string>('OSS_STS_EXTERNAL_ID')?.trim();

    const policy = this.buildEditorUploadPolicy(bucket, userId);
    const stsEndpoint = this.config.get<string>('OSS_STS_ENDPOINT')?.trim() || 'sts.aliyuncs.com';

    // 懒加载 STS SDK，避免非 STS 场景（例如单测）触发不必要的初始化副作用。
    const { Config: OpenApiConfig } = require('@alicloud/openapi-client') as {
      Config: new (config?: Record<string, unknown>) => {
        endpoint?: string;
        accessKeyId?: string;
        accessKeySecret?: string;
      };
    };
    const StsModule = require('@alicloud/sts20150401') as {
      default: new (config: unknown) => {
        assumeRole: (request: unknown) => Promise<{ body?: { requestId?: string; credentials?: {
          accessKeyId?: string;
          accessKeySecret?: string;
          securityToken?: string;
          expiration?: string;
        } } }>;
      };
      AssumeRoleRequest: new (request?: Record<string, unknown>) => unknown;
    };

    const stsConfig = new OpenApiConfig({
      endpoint: stsEndpoint,
      accessKeyId,
      accessKeySecret,
    });
    const stsClient = new StsModule.default(stsConfig);
    const assumeRoleRequest = new StsModule.AssumeRoleRequest({
      roleArn,
      roleSessionName,
      durationSeconds,
      policy,
      ...(externalId ? { externalId } : {}),
    });
    const assumeRoleResponse = await stsClient.assumeRole(assumeRoleRequest);
    const credentials = assumeRoleResponse.body?.credentials;

    if (!credentials?.accessKeyId || !credentials.accessKeySecret || !credentials.securityToken) {
      this.logger.error(
        `STS AssumeRole 未返回完整凭证，requestId=${assumeRoleResponse.body?.requestId || 'unknown'}`,
      );
      throw new Error('STS 凭证生成失败，请检查 RAM 角色与 STS 配置');
    }

    const endpoint = this.config.get<string>('OSS_BROWSER_ENDPOINT')?.trim();
    const authorizationV4 = this.readBoolEnv('OSS_AUTHORIZATION_V4', true);
    const partSize = this.readIntEnv(
      'OSS_DIRECT_UPLOAD_PART_SIZE',
      512 * 1024,
      100 * 1024,
      100 * 1024 * 1024,
    );
    const parallel = this.readIntEnv('OSS_DIRECT_UPLOAD_PARALLEL', 3, 1, 8);

    return {
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      securityToken: credentials.securityToken,
      expiration: credentials.expiration || '',
      region,
      bucket,
      endpoint: endpoint || undefined,
      authorizationV4,
      partSize,
      parallel,
      objectKey,
      url: this.buildPublicObjectUrl(objectKey),
    };
  }

  buildPublicObjectUrl(objectKey: string): string {
    const key = objectKey.replace(/^\//, '');
    const publicBase = this.config.get<string>('OSS_PUBLIC_BASE_URL')?.trim();
    if (publicBase) {
      const base = publicBase.replace(/\/$/, '');
      return `${base}/${key}`;
    }

    const bucket = this.getRequiredEnv('OSS_BUCKET');
    const region = this.getRequiredEnv('OSS_REGION');
    const protocol = this.readBoolEnv('OSS_SECURE', true) ? 'https' : 'http';
    const endpoint =
      this.config.get<string>('OSS_PUBLIC_ENDPOINT')?.trim() ||
      this.config.get<string>('OSS_BROWSER_ENDPOINT')?.trim();

    if (endpoint) {
      const normalized = endpoint.replace(/^https?:\/\//i, '').replace(/\/$/, '');
      if (normalized.startsWith(`${bucket}.`)) {
        return `${protocol}://${normalized}/${key}`;
      }
      return `${protocol}://${bucket}.${normalized}/${key}`;
    }

    return `${protocol}://${bucket}.${region}.aliyuncs.com/${key}`;
  }

  /**
   * 从 OSS 删除文件
   */
  async deleteFile(objectKey: string): Promise<void> {
    const client = this.getClient();
    const remove = client.delete;
    if (!remove) {
      throw new Error('当前 OSS 客户端不支持 delete 操作');
    }
    await remove.call(client, objectKey);
  }

  private getRequiredEnv(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new Error(`缺少环境变量 ${name}`);
    }
    return value;
  }

  private readIntEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = this.config.get<string>(name)?.trim();
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  private readBoolEnv(name: string, fallback: boolean): boolean {
    const raw = this.config.get<string>(name)?.trim();
    if (!raw) return fallback;
    const value = raw.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'off'].includes(value)) return false;
    return fallback;
  }

  private isNotFoundError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybe = error as { status?: unknown; code?: unknown; name?: unknown };
    return (
      maybe.status === 404 ||
      maybe.code === 'NoSuchKey' ||
      maybe.name === 'NoSuchKeyError' ||
      maybe.code === 'NotFound'
    );
  }

  private buildRoleSessionName(prefix: string, userId: string): string {
    const safePrefix = prefix.replace(/[^a-zA-Z0-9._@-]/g, '').slice(0, 24) || 'coink';
    const safeUser = userId.replace(/[^a-zA-Z0-9._@-]/g, '').slice(-16) || 'user';
    const time = Date.now().toString(36);
    const merged = `${safePrefix}-${safeUser}-${time}`.slice(0, 64);
    return merged.length >= 2 ? merged : 'coink-upload';
  }

  private buildEditorUploadPolicy(bucket: string, userId: string): string {
    const safeUser = userId.replace(/\*/g, '');
    const resource = `acs:oss:*:*:${bucket}/editor-images/${safeUser}/*`;
    const policy = {
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'oss:PutObject',
            'oss:AbortMultipartUpload',
            'oss:ListParts',
            'oss:ListMultipartUploads',
            'oss:CompleteMultipartUpload',
          ],
          Resource: [resource],
        },
      ],
    };
    return JSON.stringify(policy);
  }
}
