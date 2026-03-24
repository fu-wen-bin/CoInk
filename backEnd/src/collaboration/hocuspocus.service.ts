import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Server } from '@hocuspocus/server';
import { encodeStateAsUpdate } from 'yjs';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyStoredDocumentToYdoc, TIPTAP_COLLABORATION_FIELD } from './document-yjs-storage';

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

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.server = new Server({
      port: 9999,
      debounce: 3000,
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
      onStoreDocument: async ({ documentName, document }) => {
        try {
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
              },
              update: {
                content: jsonContent,
                y_state: Buffer.from(state),
                updated_at: now,
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
        }
      },
      onConnect: async ({ requestParameters }) => {
        const token = requestParameters.get('token');
        this.logger.debug(`客户端已连接，鉴权令牌: ${token ? '已携带' : '缺失'}`);
        await Promise.resolve();
      },
      onDisconnect: async () => {
        this.logger.debug('客户端已断开连接');
        await Promise.resolve();
      },
    });

    void this.server.listen();
    this.logger.log('协作服务已启动: ws://localhost:9999');
  }

  onModuleDestroy() {
    void this.server?.destroy();
    this.logger.log('协作服务已停止');
  }
}
