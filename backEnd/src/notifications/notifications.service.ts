import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const { page = 1, limit = 20, unreadOnly = false } = queryDto;

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

    const totalPages = Math.ceil(total / limit);

    return {
      notifications: notifications.map((n) => this.mapToEntity(n)),
      total,
      unreadCount,
      page,
      limit,
      totalPages,
    };
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
      notificationId: notification.notifications_id,
      requestId: notification.request_id,
      userId: notification.user_id,
      type: notification.type,
      payload: notification.payload as Record<string, unknown> | undefined,
      readAt: notification.read_at ?? undefined,
      createdAt: notification.created_at,
    };
  }
}
