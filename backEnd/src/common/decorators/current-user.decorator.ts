import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * JWT Payload 类型定义
 */
interface JwtPayload {
  userId: string;
  email?: string;
  name: string;
  role?: string;
  tokenType?: 'access' | 'refresh';
  iat?: number;
}

/**
 * 从请求中提取当前用户的装饰器
 * 使用方式: @CurrentUser() user: CurrentUser
 * 使用方式: @CurrentUser('userId') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUser | undefined;

    if (!user) {
      throw new UnauthorizedException('用户未登录');
    }

    return data ? user[data] : user;
  },
);

/**
 * 当前用户接口，从 JWT token 中提取
 */
export interface CurrentUser extends JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Decorator to extract just the userId from the current user
 * Usage: @CurrentUserId() userId: string
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.userId as string | undefined;

    if (!userId) {
      throw new UnauthorizedException('用户未登录');
    }

    return userId;
  },
);

/**
 * Decorator to extract the user role from the current user
 * Usage: @CurrentUserRole() role: string
 */
export const CurrentUserRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const role = (request.user?.role as string) || 'USER';
    return role;
  },
);
