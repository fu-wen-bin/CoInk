import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Server } from '@hocuspocus/server';
import { encodeStateAsUpdate } from 'yjs';

import { Prisma } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { applyStoredDocumentToYdoc, TIPTAP_COLLABORATION_FIELD } from './document-yjs-storage';

// 权限等级映射
const PERMISSION_LEVELS: Record<string, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  manage: 4,
};

/**
 * Hocuspocus 协同编辑服务
 *
 * - `y_state`：Yjs 完整快照（协同加载优先）
 * - `content`：Tiptap JSON（检索 / REST / 导出）
 *
 * 端口: 9999（与前端配置一致）
 */
@Injectable()
export class HocuspocusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HocuspocusService.name);
  private server: Server;
  private readonly socketUsers = new Map<string, string | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  onModuleInit() {
    this.server = new Server({
      port: 9999,
      debounce: 3000,

      /**
       * 连接时验证用户权限
       * 这是关键：在建立 WebSocket 连接前验证用户是否有权访问文档
       */
      onConnect: async ({ requestParameters, request, documentName, socketId, context }) => {
        try {
          const tokenFromParam = requestParameters.get('token');
          const rawCookie = request.headers?.cookie;
          const cookies = Array.isArray(rawCookie) ? rawCookie.join(';') : (rawCookie ?? '');
          const userId = await this.extractUserId(cookies, tokenFromParam);

          // 检查用户是否有权访问文档
          const hasPermission = await this.checkDocumentPermission(documentName, userId);

          if (!hasPermission) {
            this.logger.warn(`文档 ${documentName}: ${userId ?? '匿名用户'} 无权限访问`);
            return Promise.reject(new Error('Forbidden'));
          }

          const authContext = context as { userId?: string | null };
          authContext.userId = userId;
          this.socketUsers.set(socketId, userId);
          this.logger.debug(`文档 ${documentName}: ${userId ?? '匿名用户'} 已连接`);
          return Promise.resolve();
        } catch (error) {
          this.logger.error(`连接验证失败: ${documentName}`, error);
          return Promise.reject(new Error('Authentication failed'));
        }
      },

      /**
       * 每次协作变更先做编辑权限校验，避免撤权后继续实时写入
       * 注意：只读用户仍可连接查看，但无法推送变更
       */
      onChange: async ({ documentName, context, socketId }) => {
        try {
          const userId = this.resolveUserId(context, socketId);
          const canEdit = await this.checkEditPermission(documentName, userId);

          if (!canEdit) {
            this.logger.warn(
              `文档 ${documentName}: ${userId ?? '匿名用户'} 无编辑权限，忽略变更`,
            );
            // 不抛出错误，静默返回 - 前端会处理只读状态
            return;
          }
        } catch (error) {
          this.logger.error(`文档 ${documentName}: 权限检查失败`, error);
          // 权限检查失败时保守处理：拒绝变更
          return;
        }
      },

      /**
       * 加载文档
       */
      onLoadDocument: async ({ documentName, document }) => {
        try {
          const row = await this.prisma.document_contents.findUnique({
            where: { document_id: documentName },
          });
          if (row) {
            applyStoredDocumentToYdoc(document, row);
          }
        } catch (error) {
          this.logger.error(`加载协作文档失败: ${documentName}`, error);
        }
      },

      /**
       * 保存文档
       */
      onStoreDocument: async ({ documentName, document, context, socketId }) => {
        try {
          const userId = this.resolveUserId(context, socketId);

          // 检查用户是否有编辑权限
          const canEdit = await this.checkEditPermission(documentName, userId);

          if (!canEdit) {
            this.logger.warn(
              `文档 ${documentName}: ${userId ?? '匿名用户'} 无编辑权限，拒绝保存`,
            );
            // 静默返回，不保存 - 前端会处理只读状态
            return;
          }

          const state = encodeStateAsUpdate(document);
          const jsonContent = JSON.parse(
            JSON.stringify(TiptapTransformer.fromYdoc(document, TIPTAP_COLLABORATION_FIELD)),
          ) as Prisma.InputJsonValue;

          const now = new Date();

          await this.prisma.$transaction([
            this.prisma.document_contents.upsert({
              where: { document_id: documentName },
              create: {
                document_id: documentName,
                content: jsonContent,
                y_state: Buffer.from(state),
                updated_by: userId,
              },
              update: {
                content: jsonContent,
                y_state: Buffer.from(state),
                updated_at: now,
                updated_by: userId,
              },
            }),
            this.prisma.documents_info.updateMany({
              where: { document_id: documentName },
              data: { updated_at: now },
            }),
          ]);

          this.logger.debug(`文档已保存: ${documentName}（y_state + Tiptap JSON）`);

          document.broadcastStateless(
            JSON.stringify({
              type: 'coink:document-saved',
              documentId: documentName,
              updatedAt: now.toISOString(),
            }),
          );
        } catch (error) {
          this.logger.error(`保存协作文档失败: ${documentName}`, error);
          // 不抛出错误，避免崩溃
        }
      },

      onDisconnect: async ({ documentName, socketId }) => {
        this.socketUsers.delete(socketId);
        this.logger.debug(`客户端已断开连接: ${documentName}`);
        await Promise.resolve();
      },
    });

    void this.server.listen();
    this.logger.log('协作服务已启动: ws://localhost:9999');
  }

  onModuleDestroy() {
    this.socketUsers.clear();
    void this.server?.destroy();
    this.logger.log('协作服务已停止');
  }

  private resolveUserId(context: unknown, socketId: string): string | null {
    const contextUserId =
      typeof context === 'object' &&
      context !== null &&
      'userId' in context &&
      typeof (context as { userId?: unknown }).userId === 'string'
        ? ((context as { userId: string }).userId ?? null)
        : null;

    if (contextUserId) {
      return contextUserId;
    }

    return this.socketUsers.get(socketId) ?? null;
  }

  /**
   * 从 cookie 中提取用户 ID
   * 需要实现 JWT 验证逻辑
   */
  private async extractUserId(
    cookies: string,
    tokenFromParam?: string | null,
  ): Promise<string | null> {
    const cookieMatch = cookies.match(/access_token=([^;]+)/);
    const tokenFromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
    const token = tokenFromCookie || tokenFromParam || null;

    if (!token) {
      return null;
    }

    try {
      const verified = await this.authService.verifyToken(token);
      if (!verified.valid || !verified.payload?.userId) {
        return null;
      }
      return verified.payload.userId;
    } catch (error) {
      this.logger.error('Token 验证失败', error);
      return null;
    }
  }

  /**
   * 检查用户是否有权访问文档
   */
  private async checkDocumentPermission(documentId: string, userId: string | null): Promise<boolean> {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      return false;
    }

    // 文档被软删除
    if (doc.is_deleted) {
      return false;
    }

    // 所有者有完整权限
    if (userId && doc.owner_id === userId) {
      return true;
    }

    if (!userId) {
      return Boolean(doc.link_permission && doc.link_permission !== 'close');
    }

    // 检查直接权限
    const principal = await this.prisma.document_principals.findUnique({
      where: {
        document_id_principal_type_principal_id: {
          document_id: documentId,
          principal_type: 'user',
          principal_id: userId,
        },
      },
    });

    if (principal?.permission) {
      return true;
    }

    // 检查组权限
    const userGroups = await this.prisma.group_members.findMany({
      where: { user_id: userId },
    });

    if (userGroups.length > 0) {
      const groupPermissions = await this.prisma.document_principals.findMany({
        where: {
          document_id: documentId,
          principal_type: 'group',
          principal_id: {
            in: userGroups.map((g) => g.group_id),
          },
        },
      });

      if (groupPermissions.length > 0) {
        return true;
      }
    }

    // 检查链接权限
    if (doc.link_permission && doc.link_permission !== 'close') {
      return true;
    }

    return false;
  }

  /**
   * 检查用户是否有编辑权限
   */
  private async checkEditPermission(documentId: string, userId: string | null): Promise<boolean> {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      return false;
    }

    // 文档被软删除
    if (doc.is_deleted) {
      return false;
    }

    // 所有者有完整权限
    if (userId && doc.owner_id === userId) {
      return true;
    }

    let highestLevel = 0;

    // 链接权限是基础权限，后续会与 ACL 取最高级
    if (doc.link_permission === 'view') {
      highestLevel = Math.max(highestLevel, PERMISSION_LEVELS.view);
    } else if (doc.link_permission === 'edit') {
      highestLevel = Math.max(highestLevel, PERMISSION_LEVELS.edit);
    }

    if (!userId) {
      return highestLevel >= PERMISSION_LEVELS.edit;
    }

    // 直接权限
    const principal = await this.prisma.document_principals.findUnique({
      where: {
        document_id_principal_type_principal_id: {
          document_id: documentId,
          principal_type: 'user',
          principal_id: userId,
        },
      },
    });

    if (principal?.permission) {
      highestLevel = Math.max(highestLevel, PERMISSION_LEVELS[principal.permission]);
    }

    // 组权限
    const userGroups = await this.prisma.group_members.findMany({
      where: { user_id: userId },
    });

    if (userGroups.length > 0) {
      const groupPermissions = await this.prisma.document_principals.findMany({
        where: {
          document_id: documentId,
          principal_type: 'group',
          principal_id: {
            in: userGroups.map((g) => g.group_id),
          },
        },
      });

      for (const groupPermission of groupPermissions) {
        highestLevel = Math.max(highestLevel, PERMISSION_LEVELS[groupPermission.permission]);
      }
    }

    return highestLevel >= PERMISSION_LEVELS.edit;
  }
}
