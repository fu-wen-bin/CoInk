import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 获取未读通知数
   */
  @Get('unread')
  async getUnreadCount(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * 获取通知列表（分页）
   */
  @Get()
  async findAll(@Req() req: Request, @Query() queryDto: QueryNotificationDto) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.findAll(userId, queryDto);
  }

  /**
   * 标记已读
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') notificationId: string, @Req() req: Request) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.markAsRead(BigInt(notificationId), userId);
  }

  /**
   * 标记全部已读
   */
  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * 删除通知
   */
  @Delete(':id')
  async remove(@Param('id') notificationId: string, @Req() req: Request) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.remove(BigInt(notificationId), userId);
  }

  /**
   * 重试失败推送
   */
  @Post('failed/retry')
  async retryFailed(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.retryFailed(userId);
  }

  /**
   * 清理过期通知
   */
  @Delete('expired')
  async clearExpired(@Req() req: Request) {
    const userId = await this.requireUserId(req);
    return this.notificationsService.clearExpired(userId);
  }

  private async extractUserIdFromRequest(req: Request): Promise<string | null> {
    const accessToken =
      typeof req.cookies?.access_token === 'string' ? req.cookies.access_token : undefined;

    if (!accessToken) {
      return null;
    }

    const verified = await this.authService.verifyToken(accessToken);
    if (!verified.valid || !verified.payload?.userId) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    return verified.payload.userId;
  }

  private async requireUserId(req: Request): Promise<string> {
    const userId = await this.extractUserIdFromRequest(req);
    if (!userId) {
      throw new UnauthorizedException('请先登录');
    }
    return userId;
  }
}
