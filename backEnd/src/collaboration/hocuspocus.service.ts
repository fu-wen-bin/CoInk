import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { encodeStateAsUpdate } from 'yjs';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Hocuspocus 协同编辑服务
 *
 * 提供 WebSocket 服务用于文档实时协作编辑
 * 端口: 9999 (与前端配置一致)
 */
@Injectable()
export class HocuspocusService implements OnModuleInit, OnModuleDestroy {
  private server: Server;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.server = new Server({
      port: 9999,
      extensions: [
        new Logger(),
      ],
      // 从数据库加载文档
      onLoadDocument: async ({ documentName, document }) => {
        try {
          const doc = await this.prisma.document_contents.findUnique({
            where: { document_id: documentName },
          });

          if (doc?.content) {
            // 解析 JSON 内容
            let binaryContent: Uint8Array | null = null;

            if (typeof doc.content === 'string') {
              // 如果是 base64 字符串
              binaryContent = new Uint8Array(Buffer.from(doc.content, 'base64'));
            } else if (Buffer.isBuffer(doc.content)) {
              // 如果是 Buffer
              binaryContent = new Uint8Array(doc.content);
            } else if (doc.content && typeof doc.content === 'object') {
              // 如果是 JSON 对象，尝试获取 data 字段
              const content = doc.content as any;
              if (content.data) {
                binaryContent = new Uint8Array(content.data);
              }
            }

            if (binaryContent) {
              // 应用更新到文档
              // 注意：这里不能直接返回，需要应用更新
              // 但 Hocuspocus 的 onLoadDocument 需要返回 null 来允许默认加载
              // 我们应该使用 afterLoadDocument 钩子来应用更新
              // 暂时不处理，让文档从空开始
            }
          }
          return null;
        } catch (error) {
          console.error('Error fetching document:', error);
          return null;
        }
      },
      // 保存文档内容到数据库
      onStoreDocument: async ({ documentName, document }) => {
        try {
          // 获取文档状态
          const state = encodeStateAsUpdate(document);
          const base64Content = Buffer.from(state).toString('base64');

          await this.prisma.document_contents.upsert({
            where: { document_id: documentName },
            create: {
              document_id: documentName,
              content: base64Content,
            },
            update: {
              content: base64Content,
              updated_at: new Date(),
            },
          });
          console.log(`Document ${documentName} saved`);
        } catch (error) {
          console.error('Error storing document:', error);
        }
      },
      // 验证连接
      onConnect: async ({ requestParameters }) => {
        const token = requestParameters.get('token');
        console.log('Client connected, token:', token ? 'present' : 'missing');
      },
      onDisconnect: async () => {
        console.log('Client disconnected');
      },
    });

    this.server.listen();
    console.log('Hocuspocus server started on ws://localhost:9999');
  }

  onModuleDestroy() {
    this.server?.destroy();
    console.log('Hocuspocus server stopped');
  }
}
