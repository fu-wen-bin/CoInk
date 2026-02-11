import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { GithubLoginDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';

// 认证控制器：提供注册、登录、刷新与 GitHub OAuth 回调
@Controller('auth')
export class AuthController {
  // 依赖注入认证服务
  constructor(private readonly authService: AuthService) {}

  // 邮箱注册
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // 邮箱登录
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // GitHub OAuth 登录（code 交换）
  @Post('github')
  githubLogin(@Body() githubLoginDto: GithubLoginDto) {
    return this.authService.githubLogin(githubLoginDto);
  }

  // GitHub OAuth 回调（GET /auth/oauth/callback?code=xxx）
  @Get('oauth/callback')
  githubCallback(@Query('code') code: string) {
    if (!code) {
      throw new BadRequestException('缺少授权码');
    }
    return this.authService.githubLogin({ code });
  }

  // 刷新 Token
  @Post('refresh')
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  // 获取个人信息
  @Get('profile/:userId')
  getProfile(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.authService.getProfile(userId);
  }

  // 更新个人信息
  @Patch('profile/:userId')
  updateProfile(@Param('userId') userId: string, @Body() updateAuthDto: UpdateAuthDto) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.authService.updateProfile(userId, updateAuthDto);
  }

  // 修改密码
  @Patch('profile/:userId/password')
  changePassword(
    @Param('userId') userId: string,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('oldPassword and newPassword are required');
    }
    return this.authService.changePassword(userId, oldPassword, newPassword);
  }

  // 重置密码（发送重置邮件）
  @Post('reset')
  resetPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('email is required');
    }
    return this.authService.resetPassword(email);
  }
}
