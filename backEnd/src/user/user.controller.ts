import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { UserService } from './user.service';

/**
 * 用户控制器
 * 只保留用户搜索功能，其他用户管理功能通过 Auth 模块处理
 */
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取用户信息
   * URL: GET /user/info?userId=xxx
   */
  @Get('info')
  getInfo(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.userService.getInfo(userId);
  }

  /**
   * 搜索用户
   * URL: GET /user/search?q=keyword
   */
  @Get('search')
  search(@Query('q') q: string) {
    if (!q) {
      return [];
    }
    return this.userService.search(q);
  }
}
