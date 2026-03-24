import { Injectable, Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly enableDebugLogs = process.env.NODE_ENV !== 'production';
  private io: Server | null = null;

  attach(app: INestApplication): void {
    if (this.io) {
      return;
    }

    const origin = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const httpServer = app.getHttpServer() as HttpServer;

    this.io = new Server(httpServer, {
      path: '/ws/app',
      cors: {
        origin,
        credentials: true,
      },
    });

    this.io.on('connection', (socket) => {
      const rawUserId = socket.handshake.query.userId;
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

      if (typeof userId === 'string' && userId.trim()) {
        void socket.join(this.roomOf(userId));
      }

      socket.on('subscribe', (payload: { userId?: string }) => {
        const id = payload?.userId?.trim();
        if (!id) return;
        void socket.join(this.roomOf(id));
      });

      socket.on('disconnect', (reason) => {
        if (!this.enableDebugLogs) {
          return;
        }
        this.logger.debug(`Socket 已断开: ${socket.id}, 原因: ${reason}`);
      });
    });

    this.logger.log('Realtime 实时服务已挂载，路径: /ws/app');
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.io) {
      return;
    }
    this.io.to(this.roomOf(userId)).emit(event, payload);
  }

  private roomOf(userId: string): string {
    return `user:${userId}`;
  }
}
