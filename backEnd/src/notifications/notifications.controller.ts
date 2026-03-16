import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUserId } from '../common/decorators/current-user.decorator';

import { MarkReadDto } from './dto/mark-read.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 获取未读通知数
   */
  @Get('unread')
  getUnreadCount(@CurrentUserId() userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * 获取通知列表（分页）
   */
  @Get()
  findAll(@CurrentUserId() userId: string, @Query() queryDto: QueryNotificationDto) {
    return this.notificationsService.findAll(userId, queryDto);
  }

  /**
   * 标记已读
   */
  @Patch(':id/read')
  markAsRead(@Param('id') notificationId: string, @CurrentUserId() userId: string) {
    return this.notificationsService.markAsRead(BigInt(notificationId), userId);
  }

  /**
   * 标记全部已读
   */
  @Patch('read-all')
  markAllAsRead(@CurrentUserId() userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * 删除通知
   */
  @Delete(':id')
  remove(@Param('id') notificationId: string, @CurrentUserId() userId: string) {
    return this.notificationsService.remove(BigInt(notificationId), userId);
  }

  /**
   * 重试失败推送
   */
  @Post('failed/retry')
  retryFailed(@CurrentUserId() userId: string) {
    return this.notificationsService.retryFailed(userId);
  }

  /**
   * 清理过期通知
   */
  @Delete('expired')
  clearExpired(@CurrentUserId() userId: string) {
    return this.notificationsService.clearExpired(userId);
  }
}
