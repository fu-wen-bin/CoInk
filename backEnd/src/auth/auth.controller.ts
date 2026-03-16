import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { randomBytes } from 'crypto';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
/**
 * 认证控制器
 *
 * 使用 HTTP-Only Cookie 存储 JWT Token
 * - access_token: Access Token (15分钟)
 * - refresh_token: Refresh Token (7天)
 */
@UseInterceptors(ClassSerializerInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 设置认证 Cookie
   */
  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    // Access Token - 15分钟
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15分钟
    });

    // Refresh Token - 7天
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    });
  }

  /**
   * 清除认证 Cookie
   */
  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('github_token');
  }

  /**
   * 邮箱注册
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);

    // 注册成功后自动登录，设置 Cookie
    // AuthResponse 类型：{ accessToken, refreshToken, user }
    const authData = result as unknown as { accessToken?: string; refreshToken?: string };
    if (authData?.accessToken && authData?.refreshToken) {
      this.setAuthCookies(res, {
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    }

    return result;
  }

  /**
   * 邮箱登录
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);

    // 设置 HTTP-Only Cookie
    const authData = result as unknown as { accessToken?: string; refreshToken?: string };
    if (authData?.accessToken && authData?.refreshToken) {
      this.setAuthCookies(res, {
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    }

    return result;
  }

  /**
   * GitHub OAuth 登录
   */
  // 1) 前端跳到这里 -> 后端重定向 GitHub 授权页
  @Get('github')
  githubStart(@Res() res: Response) {
    const state = randomBytes(16).toString('hex');

    // 用 cookie 保存 state（简单可用；也可用 redis/session）
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: false, // 本地 http 必须 false；线上 https 必须 true
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: 'http://localhost:8888/auth/github/callback',
      scope: 'read:user user:email',
      state,
    });

    return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }

  /**
   * GitHub OAuth 回调
   */

  // 2) GitHub 授权完成回调到这里 -> 后端处理完写 cookie -> 重定向回前端进度页
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code) throw new BadRequestException('缺少授权码 code');

    // 校验 state（防 CSRF）
    const stateInCookie = (req.cookies?.oauth_state as string | undefined) ?? '';
    if (!state || !stateInCookie || state !== stateInCookie) {
      // 直接跳回前端失败页（不暴露具体错误也行）
      return res.redirect('http://localhost:3000/auth/callback?status=fail&reason=bad_state');
    }

    // state 用完就删
    res.clearCookie('oauth_state', { path: '/' });

    try {
      // 你现有的逻辑：code -> GitHub token -> GitHub 用户 -> 本地用户 -> 签发 access/refresh
      const result = await this.authService.githubLogin({ code });
      // result: { accessToken, refreshToken, user: {...} }

      // JWT 放 cookie
      res.cookie('github_token', result.githubToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      });

      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      // 重定向到前端展示“认证进度/成功”
      return res.redirect('http://localhost:3000/auth/callback?status=ok');
    } catch (e) {
      // 失败也重定向回去，让前端展示失败状态
      return res.redirect('http://localhost:3000/auth/callback?status=fail');
    }
  }

  /**
   * 刷新 Token
   * 从 HTTP-Only Cookie 中读取 refresh_token
   */
  @Post('refresh')
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken =
      typeof req.cookies?.refresh_token === 'string' ? req.cookies.refresh_token : undefined;

    if (!refreshToken) {
      throw new BadRequestException('缺少 refresh token');
    }

    const result = await this.authService.refreshToken({ refreshToken });

    // 更新 Cookie
    const authData = result as unknown as { accessToken?: string; refreshToken?: string };
    if (authData?.accessToken && authData?.refreshToken) {
      this.setAuthCookies(res, {
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    }

    return result;
  }

  /**
   * 退出登录
   */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return { code: 200, message: '退出成功' };
  }

  /**
   * 获取个人信息
   */
  @Get('profile/:userId')
  getProfile(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.authService.getProfile(userId);
  }

  /**
   * 更新个人信息
   */
  @Patch('profile/:userId')
  updateProfile(@Param('userId') userId: string, @Body() updateAuthDto: UpdateAuthDto) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.authService.updateProfile(userId, updateAuthDto);
  }

  /**
   * 修改密码
   */
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

  /**
   * 重置密码
   */
  @Post('reset')
  resetPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('email is required');
    }
    return this.authService.resetPassword(email);
  }

  /**
   * 验证 JWT Token
   * 从 HTTP-Only Cookie 中读取 access_token
   */
  @Get('verify')
  verifyToken(@Req() req: Request) {
    const accessToken =
      typeof req.cookies?.access_token === 'string' ? req.cookies.access_token : undefined;
    console.log('验证 Token，accessToken:', accessToken);
    if (!accessToken) {
      throw new BadRequestException('缺少 access token');
    }

    return this.authService.verifyToken(accessToken);
  }
}
