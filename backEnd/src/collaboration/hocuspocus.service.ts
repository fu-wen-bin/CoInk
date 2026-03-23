import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
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
  private server: Server;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.server = new Server({
      port: 9999,
      debounce: 3000,
      extensions: [new Logger()],
      onLoadDocument: async ({ documentName, document }) => {
        try {
          const row = await this.prisma.document_contents.findUnique({
            where: { document_id: documentName },
          });
          if (row) {
            applyStoredDocumentToYdoc(document, row);
          }
        } catch (error) {
          console.error('Error loading document:', error);
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
          console.log(
            `Document ${documentName} saved (y_state + Tiptap JSON, documents_info.updated_at synced)`,
          );

          document.broadcastStateless(
            JSON.stringify({
              type: 'coink:document-saved',
              documentId: documentName,
              updatedAt: now.toISOString(),
            }),
          );
        } catch (error) {
          console.error('Error storing document:', error);
        }
      },
      onConnect: async ({ requestParameters }) => {
        const token = requestParameters.get('token');
        console.log('Client connected, token:', token ? 'present' : 'missing');
        await Promise.resolve();
      },
      onDisconnect: async () => {
        console.log('Client disconnected');
        await Promise.resolve();
      },
    });

    void this.server.listen();
    console.log('Hocuspocus server started on ws://localhost:9999');
  }

  onModuleDestroy() {
    void this.server?.destroy();
    console.log('Hocuspocus server stopped');
  }
}
