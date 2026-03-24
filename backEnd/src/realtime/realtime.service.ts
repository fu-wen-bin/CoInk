import { Injectable, Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private io: Server | null = null;

  attach(app: INestApplication): void {
    if (this.io) {
      return;
    }

    const origin = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    this.io = new Server(app.getHttpServer(), {
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
        socket.join(this.roomOf(userId));
      }

      socket.on('subscribe', (payload: { userId?: string }) => {
        const id = payload?.userId?.trim();
        if (!id) return;
        socket.join(this.roomOf(id));
      });

      socket.on('disconnect', () => {
        this.logger.debug(`socket disconnected: ${socket.id}`);
      });
    });

    this.logger.log('Realtime socket server attached at path /ws/app');
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


