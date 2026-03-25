import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createAndPush(params: {
    userId: string;
    requestId: bigint;
    type: string;
    payload?: Record<string, unknown>;
    event?: string;
  }): Promise<Notification> {
    const created = await this.prisma.notifications.create({
      data: {
        request_id: params.requestId,
        user_id: params.userId,
        type: params.type,
        payload:
          params.payload === undefined ? undefined : (params.payload as Prisma.InputJsonValue),
      },
    });

    const entity = this.mapToEntity(created);
    const unreadCount = await this.prisma.notifications.count({
      where: {
        user_id: params.userId,
        read_at: null,
      },
    });
    this.realtimeService.emitToUser(params.userId, 'notification.new', {
      notification: entity,
      unreadCount,
    });

    if (params.event) {
      this.realtimeService.emitToUser(params.userId, params.event, {
        notification: entity,
        unreadCount,
      });
    }

    return entity;
  }

  // ==================== 通知查询 ====================

  /**
   * 获取未读通知数
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notifications.count({
      where: {
        user_id: userId,
        read_at: null,
      },
    });

    return { count };
  }

  /**
   * 获取通知列表（分页）
   */
  async findAll(
    userId: string,
    queryDto: QueryNotificationDto,
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = this.toPositiveInt(queryDto.page, 1);
    const limit = Math.min(this.toPositiveInt(queryDto.limit, 20), 100);
    const unreadOnly = this.toBoolean(queryDto.unreadOnly);

    const where: Record<string, unknown> = {
      user_id: userId,
    };

    if (unreadOnly) {
      where.read_at = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({
        where: {
          user_id: userId,
          read_at: null,
        },
      }),
    ]);

    // 为“创建类请求通知”补齐实时状态，避免前端在已处理后仍显示“同意/拒绝”按钮
    const permissionRequestIds = notifications
      .filter((n) => n.type === 'PERMISSION_REQUEST_CREATED')
      .map((n) => n.request_id);
    const friendRequestIds = notifications
      .filter((n) => n.type === 'FRIEND_REQUEST_CREATED')
      .map((n) => n.request_id);

    const [permissionRows, friendRows] = await Promise.all([
      permissionRequestIds.length > 0
        ? this.prisma.permission_requests.findMany({
            where: { request_id: { in: permissionRequestIds } },
            select: { request_id: true, status: true },
          })
        : Promise.resolve([] as { request_id: bigint; status: string }[]),
      friendRequestIds.length > 0
        ? this.prisma.friend_requests.findMany({
            where: { request_id: { in: friendRequestIds } },
            select: { request_id: true, status: true },
          })
        : Promise.resolve([] as { request_id: bigint; status: string }[]),
    ]);

    const permissionStatusMap = new Map(permissionRows.map((r) => [r.request_id.toString(), r.status]));
    const friendStatusMap = new Map(friendRows.map((r) => [r.request_id.toString(), r.status]));

    const enrichedNotifications = notifications.map((n) => {
      const payload =
        n.payload && typeof n.payload === 'object' && !Array.isArray(n.payload)
          ? (n.payload as Record<string, unknown>)
          : {};

      if (n.type === 'PERMISSION_REQUEST_CREATED') {
        const status = permissionStatusMap.get(n.request_id.toString());
        if (status) {
          return { ...n, payload: { ...payload, status } };
        }
      }

      if (n.type === 'FRIEND_REQUEST_CREATED') {
        const status = friendStatusMap.get(n.request_id.toString());
        if (status) {
          return { ...n, payload: { ...payload, status } };
        }
      }

      return n;
    });

    const totalPages = Math.ceil(total / limit);

    return {
      notifications: enrichedNotifications.map((n) => this.mapToEntity(n)),
      total,
      unreadCount,
      page,
      limit,
      totalPages,
    };
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    const n =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (!Number.isFinite(n) || n < 1) {
      return fallback;
    }
    return Math.floor(n);
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1';
    }
    return false;
  }

  /**
   * 标记单个通知已读
   */
  async markAsRead(notificationId: bigint, userId: string): Promise<Notification> {
    const notification = await this.prisma.notifications.findUnique({
      where: { notifications_id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.user_id !== userId) {
      throw new NotFoundException('通知不存在');
    }

    const updated = await this.prisma.notifications.update({
      where: { notifications_id: notificationId },
      data: { read_at: new Date() },
    });

    return this.mapToEntity(updated);
  }

  /**
   * 标记全部已读
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notifications.updateMany({
      where: {
        user_id: userId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return { count: result.count };
  }

  /**
   * 删除通知
   */
  async remove(notificationId: bigint, userId: string): Promise<void> {
    const notification = await this.prisma.notifications.findUnique({
      where: { notifications_id: notificationId },
    });

    if (!notification || notification.user_id !== userId) {
      throw new NotFoundException('通知不存在');
    }

    await this.prisma.notifications.delete({
      where: { notifications_id: notificationId },
    });
  }

  /**
   * 重试失败推送（清理相关通知并重新触发）
   */
  async retryFailed(userId: string): Promise<{ success: boolean; message: string }> {
    // 查找与权限请求相关的失败通知
    const failedNotifications = await this.prisma.notifications.findMany({
      where: {
        user_id: userId,
        type: 'PERMISSION_REQUEST_FAILED',
        read_at: null,
      },
    });

    if (failedNotifications.length === 0) {
      return { success: true, message: '没有需要重试的失败推送' };
    }

    // 标记这些通知为已读（表示已处理）
    await this.prisma.notifications.updateMany({
      where: {
        notifications_id: {
          in: failedNotifications.map((n) => n.notifications_id),
        },
      },
      data: { read_at: new Date() },
    });

    return {
      success: true,
      message: `已重试 ${failedNotifications.length} 条失败推送`,
    };
  }

  /**
   * 清理过期通知（已读且超过30天）
   */
  async clearExpired(userId: string): Promise<{ count: number }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.notifications.deleteMany({
      where: {
        user_id: userId,
        read_at: {
          not: null,
          lte: thirtyDaysAgo,
        },
      },
    });

    return { count: result.count };
  }

  // ==================== 辅助方法 ====================

  private mapToEntity(notification: {
    notifications_id: bigint;
    request_id: bigint;
    user_id: string;
    type: string;
    payload: unknown;
    read_at: Date | null;
    created_at: Date;
  }): Notification {
    return {
      notificationId: notification.notifications_id.toString(),
      requestId: notification.request_id.toString(),
      userId: notification.user_id,
      type: notification.type,
      payload: notification.payload as Record<string, unknown> | undefined,
      readAt: notification.read_at ?? undefined,
      createdAt: notification.created_at,
    };
  }
}
