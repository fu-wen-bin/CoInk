import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import axios from 'axios';
import { nanoid } from 'nanoid';

import { users } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GithubLoginDto,
  GithubUserDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { AuthResponse, JwtPayload } from './entities/auth.entity';

// GitHub 授权码换 token 的响应结构
type GithubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
};

// GitHub 用户信息响应结构（仅保留当前使用字段）
type GithubUserApiResponse = {
  id: number;
  email?: string | null;
  name?: string | null;
  login: string;
  avatar_url?: string | null;
  blog?: string | null;
};

// 认证服务：包含邮箱登录/注册、GitHub OAuth、刷新 Token 等业务
@Injectable()
export class AuthService {
  // 注入 Prisma 与 JWT 服务
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ==================== 邮箱密码认证 ====================

  // 邮箱注册：校验邮箱唯一性 -> 哈希密码 -> 创建用户 -> 返回 token + 用户信息
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const email = registerDto.email.trim().toLowerCase();

    // 校验邮箱是否已注册
    const existing = await this.prisma.users.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException('该邮箱已被注册');
    }

    // 创建新用户
    const passwordHash = await argon2.hash(registerDto.password);
    const user = await this.prisma.users.create({
      data: {
        user_id: nanoid(),
        email,
        name: registerDto.name,
        password_hash: passwordHash,
        last_login_at: new Date(),
      },
    });

    return this.buildAuthResponse(user);
  }

  // 邮箱登录：校验密码 -> 更新最后登录时间 -> 返回 token + 用户信息
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.prisma.users.findUnique({
      where: { email },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isValid = await argon2.verify(user.password_hash, loginDto.password);
    if (!isValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 更新最近登录时间
    const updatedUser = await this.prisma.users.update({
      where: { user_id: user.user_id },
      data: { last_login_at: new Date() },
    });

    return this.buildAuthResponse(updatedUser);
  }

  // ==================== GitHub OAuth 认证 ====================

  // GitHub OAuth 登录：code 换 access_token -> 获取 GitHub 用户信息 -> 绑定/创建本地用户
  async githubLogin(githubLoginDto: GithubLoginDto): Promise<AuthResponse> {
    if (!githubLoginDto.code) {
      throw new BadRequestException('缺少授权码');
    }

    const accessToken = await this.exchangeGithubToken(githubLoginDto.code);
    const githubUser = await this.fetchGithubUser(accessToken);
    const user = await this.findOrCreateGithubUser(githubUser);

    // 更新最近登录时间
    const updatedUser = await this.prisma.users.update({
      where: { user_id: user.user_id },
      data: { last_login_at: new Date() },
    });

    return this.buildAuthResponse(updatedUser);
  }

  // 账号绑定策略：优先按 githubId；若无则按 email 绑定（避免重复账号）
  async findOrCreateGithubUser(githubUserDto: GithubUserDto) {
    const existingByGithub = await this.prisma.users.findUnique({
      where: { github_id: BigInt(githubUserDto.githubId) },
    });
    if (existingByGithub) {
      return existingByGithub;
    }

    if (githubUserDto.email) {
      const existingByEmail = await this.prisma.users.findUnique({
        where: { email: githubUserDto.email.toLowerCase() },
      });
      if (existingByEmail) {
        return this.prisma.users.update({
          where: { user_id: existingByEmail.user_id },
          data: {
            github_id: BigInt(githubUserDto.githubId),
            avatar_url: githubUserDto.avatarUrl,
            website_url: githubUserDto.websiteUrl,
            name: githubUserDto.name,
          },
        });
      }
    }

    return this.prisma.users.create({
      data: {
        user_id: nanoid(),
        email: githubUserDto.email?.toLowerCase(),
        name: githubUserDto.name,
        github_id: BigInt(githubUserDto.githubId),
        avatar_url: githubUserDto.avatarUrl,
        website_url: githubUserDto.websiteUrl,
        last_login_at: new Date(),
      },
    });
  }

  // ==================== Token 管理 ====================

  // 刷新 Token：校验 refresh token -> 重新签发 token
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    const user = await this.prisma.users.findUnique({
      where: { user_id: payload.userId },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    return this.buildAuthResponse(user);
  }

  // 校验任意 token（内部使用）
  async validateToken(token: string) {
    return this.jwtService.verifyAsync<JwtPayload>(token);
  }

  // ==================== 用户信息 ====================

  // 获取用户信息（不包含敏感字段）
  async getProfile(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.sanitizeUser(user);
  }

  // 更新用户资料（仅允许 name/email/avatar/website）
  async updateProfile(userId: string, updateAuthDto: UpdateAuthDto) {
    if (updateAuthDto.password) {
      throw new BadRequestException('请使用修改密码接口');
    }

    // 仅更新允许字段
    const updateData: Partial<users> = {};

    if (updateAuthDto.email) {
      const email = updateAuthDto.email.trim().toLowerCase();
      const existing = await this.prisma.users.findUnique({
        where: { email },
      });
      if (existing && existing.user_id !== userId) {
        throw new BadRequestException('该邮箱已被占用');
      }
      updateData.email = email;
    }

    if (updateAuthDto.name) {
      updateData.name = updateAuthDto.name;
    }

    if (updateAuthDto.avatarUrl !== undefined) {
      updateData.avatar_url = updateAuthDto.avatarUrl;
    }

    if (updateAuthDto.websiteUrl !== undefined) {
      updateData.website_url = updateAuthDto.websiteUrl;
    }

    const user = await this.prisma.users.update({
      where: { user_id: userId },
      data: updateData,
    });

    return this.sanitizeUser(user);
  }

  // ==================== 密码管理 ====================

  // 修改密码：校验旧密码 -> 哈希新密码 -> 更新
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
    });
    if (!user || !user.password_hash) {
      throw new BadRequestException('该账号未设置密码');
    }

    const isValid = await argon2.verify(user.password_hash, oldPassword);
    if (!isValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    const newPasswordHash = await argon2.hash(newPassword);
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { password_hash: newPasswordHash },
    });

    return { success: true };
  }

  // 重置密码：占位逻辑（后续可接邮件服务）
  resetPassword(email: string) {
    // TODO: 实现重置密码逻辑
    // 1. 生成重置 Token
    // 2. 发送重置邮件
    return `This action sends password reset email to: ${email}`;
  }

  // ==================== GitHub OAuth 辅助方法 ====================

  // 使用授权码向 GitHub 换取 access_token
  private async exchangeGithubToken(code: string): Promise<string> {
    const clientId = process.env.GITHUB_CLIENT_ID ?? '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? '';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth 未配置');
    }

    const response = await axios.post<GithubTokenResponse>(
      'https://github.com/login/oauth/access_token',
      null,
      {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        headers: {
          accept: 'application/json',
        },
      },
    );

    const accessToken = response.data?.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('获取访问令牌失败');
    }

    return accessToken;
  }

  // 使用 access_token 获取 GitHub 用户信息并标准化字段
  private async fetchGithubUser(accessToken: string): Promise<GithubUserDto> {
    const userAgent = process.env.GITHUB_USER_AGENT ?? 'CoInk';

    const response = await axios.get<GithubUserApiResponse>('https://api.github.com/user', {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': userAgent,
      },
    });

    const user = response.data;
    if (!user || !user.id) {
      throw new UnauthorizedException('获取 GitHub 用户信息失败');
    }

    return {
      githubId: user.id,
      email: user.email ?? undefined,
      name: user.name || user.login,
      avatarUrl: user.avatar_url ?? undefined,
      websiteUrl: user.blog ?? undefined,
    };
  }

  // ==================== 辅助方法 ====================

  // 清理用户对象，避免暴露敏感字段
  private sanitizeUser(user: users) {
    return {
      userId: user.user_id,
      email: user.email ?? undefined,
      name: user.name,
      avatarUrl: user.avatar_url ?? undefined,
      websiteUrl: user.website_url ?? undefined,
      lastLoginAt: user.last_login_at ?? undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  // 生成登录响应：签发 token 并返回用户信息
  private async buildAuthResponse(user: users): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.signTokens(user);
    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.user_id,
        email: user.email ?? undefined,
        name: user.name,
        avatarUrl: user.avatar_url ?? undefined,
        websiteUrl: user.website_url ?? undefined,
      },
    };
  }

  // 签发 access/refresh token
  private async signTokens(user: users) {
    const payload: JwtPayload = {
      userId: user.user_id,
      email: user.email ?? undefined,
      name: user.name,
      tokenType: 'access',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: '7d' },
    );

    return { accessToken, refreshToken };
  }

  // 校验 refresh token（仅允许 tokenType=refresh）
  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      if (payload.tokenType && payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('refresh token 无效');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('refresh token 无效');
    }
  }
}
