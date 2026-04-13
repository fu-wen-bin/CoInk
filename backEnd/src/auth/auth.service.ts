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

import { email_login_codes, users } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailCodeLoginDto,
  GithubLoginDto,
  GithubUserDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  SendEmailCodeDto,
} from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { AuthResponse, JwtPayload } from './entities/auth.entity';
import { EmailService } from './email.service';

// GitHub 授权码换 token 的响应结构
type GithubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
};

// GitHub 用户信息响应结构
// 完整字段参考：https://docs.github.com/en/rest/users/users#get-the-authenticated-user
type GithubUserApiResponse = {
  id: number;
  login: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  blog?: string | null;
  location?: string | null;
  company?: string | null;
  bio?: string | null;
};

// 认证服务：包含邮箱登录/注册、GitHub OAuth、刷新 Token 等业务
@Injectable()
export class AuthService {
  private readonly emailCodeLength = 6;
  private readonly emailCodeCooldownSeconds = 60;
  private readonly emailCodeExpiresMinutes = 10;
  private readonly emailCodeMaxAttempts = 5;

  // 注入 Prisma 与 JWT 服务
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // ==================== 邮箱密码认证 ====================

  /**
   * 生成默认头像 URL
   * 使用 DiceBear API 生成基于用户名的头像
   */
  private generateDefaultAvatar(username: string): string {
    const bgc = Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0');
    return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=${bgc}`;
  }

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

    // 创建新用户，自动生成默认头像
    const passwordHash = await argon2.hash(registerDto.password);
    const user = await this.prisma.users.create({
      data: {
        user_id: nanoid(),
        email,
        name: registerDto.name,
        password_hash: passwordHash,
        avatar_url: this.generateDefaultAvatar(registerDto.name),
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

  /**
   * 发送邮箱验证码（60秒冷却）
   */
  async sendEmailCode(
    sendEmailCodeDto: SendEmailCodeDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<{ success: boolean; cooldownSeconds: number }> {
    const email = this.normalizeEmail(sendEmailCodeDto.email);
    const latestCode = await this.prisma.email_login_codes.findFirst({
      where: { email },
      orderBy: { created_at: 'desc' },
    });

    if (latestCode && this.isWithinCooldown(latestCode.created_at)) {
      return { success: true, cooldownSeconds: this.emailCodeCooldownSeconds };
    }

    const code = this.generateEmailCode();
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + this.emailCodeExpiresMinutes * 60 * 1000);

    const createdCode = await this.prisma.email_login_codes.create({
      data: {
        email,
        code_hash: codeHash,
        attempt_count: 0,
        max_attempts: this.emailCodeMaxAttempts,
        expires_at: expiresAt,
        sent_ip: this.safeTruncate(meta?.ip, 45),
        sent_ua: this.safeTruncate(meta?.userAgent, 255),
      },
    });

    try {
      await this.emailService.sendLoginCode({
        email,
        code,
        expiresInMinutes: this.emailCodeExpiresMinutes,
      });
    } catch (error) {
      await this.prisma.email_login_codes
        .delete({
          where: { code_id: createdCode.code_id },
        })
        .catch(() => undefined);
      throw error;
    }

    return { success: true, cooldownSeconds: this.emailCodeCooldownSeconds };
  }

  /**
   * 邮箱验证码登录：首次自动注册，非首次直接登录
   */
  async emailCodeLogin(emailCodeLoginDto: EmailCodeLoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(emailCodeLoginDto.email);
    const verifyCode = emailCodeLoginDto.code.trim();
    const codeRecord = await this.getLatestValidCode(email);

    if (!codeRecord) {
      throw new UnauthorizedException('验证码无效或已过期');
    }

    if (codeRecord.attempt_count >= codeRecord.max_attempts) {
      throw new UnauthorizedException('验证码错误次数过多，请重新获取');
    }

    const isCodeMatched = await argon2.verify(codeRecord.code_hash, verifyCode);
    if (!isCodeMatched) {
      await this.prisma.email_login_codes.update({
        where: { code_id: codeRecord.code_id },
        data: { attempt_count: { increment: 1 } },
      });
      throw new UnauthorizedException('验证码错误');
    }

    const consumed = await this.prisma.email_login_codes.updateMany({
      where: {
        code_id: codeRecord.code_id,
        used_at: null,
      },
      data: {
        used_at: new Date(),
      },
    });

    if (consumed.count !== 1) {
      throw new UnauthorizedException('验证码已失效，请重新获取');
    }

    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });

    let isNewUser = false;
    let user: users;

    if (!existingUser) {
      isNewUser = true;
      const defaultName = this.generateDefaultNameByEmail(email);
      try {
        user = await this.prisma.users.create({
          data: {
            user_id: nanoid(),
            email,
            name: defaultName,
            avatar_url: this.generateDefaultAvatar(defaultName),
            last_login_at: new Date(),
          },
        });
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? (error as { code?: string }).code
            : undefined;
        if (code !== 'P2002') {
          throw error;
        }

        // 并发下若邮箱已被创建，回退到“已存在用户登录”流程。
        const concurrentUser = await this.prisma.users.findUnique({
          where: { email },
        });
        if (!concurrentUser) {
          throw error;
        }

        isNewUser = false;
        user = await this.prisma.users.update({
          where: { user_id: concurrentUser.user_id },
          data: { last_login_at: new Date() },
        });
      }
    } else {
      user = await this.prisma.users.update({
        where: { user_id: existingUser.user_id },
        data: { last_login_at: new Date() },
      });
    }

    return this.buildAuthResponse(user, { isNewUser });
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

    return this.buildAuthResponse(updatedUser, { githubToken: accessToken });
  }

  // 账号绑定策略：优先按 githubId；若无则按 email 绑定（避免重复账号）
  async findOrCreateGithubUser(githubUserDto: GithubUserDto) {
    const existingByGithub = await this.prisma.users.findUnique({
      where: { github_id: BigInt(githubUserDto.githubId) },
    });
    if (existingByGithub) {
      // 更新 GitHub 信息（可能用户在 GitHub 上修改了资料）
      return this.prisma.users.update({
        where: { user_id: existingByGithub.user_id },
        data: {
          github_username: githubUserDto.login,
          avatar_url: githubUserDto.avatarUrl,
          website_url: githubUserDto.websiteUrl,
          location: githubUserDto.location,
          company: githubUserDto.company,
          bio: githubUserDto.bio,
          name: githubUserDto.name,
        },
      });
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
            github_username: githubUserDto.login,
            avatar_url: githubUserDto.avatarUrl,
            website_url: githubUserDto.websiteUrl,
            location: githubUserDto.location,
            company: githubUserDto.company,
            bio: githubUserDto.bio,
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
        github_username: githubUserDto.login,
        avatar_url: githubUserDto.avatarUrl,
        website_url: githubUserDto.websiteUrl,
        location: githubUserDto.location,
        company: githubUserDto.company,
        bio: githubUserDto.bio,
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

    if (updateAuthDto.location !== undefined) {
      updateData.location = updateAuthDto.location;
    }

    if (updateAuthDto.company !== undefined) {
      updateData.company = updateAuthDto.company;
    }

    if (updateAuthDto.bio !== undefined) {
      updateData.bio = updateAuthDto.bio;
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

  // ==================== Token 验证与退出 ====================

  /**
   * 验证 JWT Token 有效性
   */
  async verifyToken(
    token: string,
  ): Promise<{ valid: boolean; payload?: JwtPayload; expired?: boolean }> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      return { valid: true, payload };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Token过期，尝试解析payload（不验证签名）
        try {
          const decoded = this.jwtService.decode(token);
          return { valid: false, expired: true, payload: decoded };
        } catch {
          return { valid: false, expired: true };
        }
      }
      return { valid: false };
    }
  }

  /**
   * 退出登录
   * 双token策略下，服务端不存储token，只需通知客户端清除即可
   * 可选：记录用户登出时间
   */
  async logout(userId: string): Promise<{ success: boolean }> {
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 可选：更新最后活动时间或记录登出日志
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { updated_at: new Date() },
    });

    // 在实际应用中，可以在这里：
    // 1. 将token加入黑名单（如果使用Redis等缓存）
    // 2. 记录登出日志
    // 3. 清除相关会话

    return { success: true };
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
    console.log(user);

    return {
      githubId: user.id,
      login: user.login,
      email: user.email ?? undefined,
      name: user.name || user.login,
      avatarUrl: user.avatar_url ?? undefined,
      websiteUrl: user.blog ?? undefined,
      htmlUrl: user.html_url ?? undefined,
      location: user.location ?? undefined,
      company: user.company ?? undefined,
      bio: user.bio ?? undefined,
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
      location: user.location ?? undefined,
      company: user.company ?? undefined,
      bio: user.bio ?? undefined,
      role: user.role ?? 'USER',
      githubId: user.github_id ? String(user.github_id) : undefined,
      githubUsername: user.github_username ?? undefined,
      lastLoginAt: user.last_login_at ?? undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  // 生成登录响应：签发 token 并返回用户信息
  private async buildAuthResponse(
    user: users,
    options?: { githubToken?: string; isNewUser?: boolean },
  ): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.signTokens(user);
    return {
      accessToken,
      refreshToken,
      githubToken: options?.githubToken,
      isNewUser: options?.isNewUser,
      user: this.sanitizeUser(user),
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateEmailCode() {
    const max = 10 ** this.emailCodeLength;
    const min = 10 ** (this.emailCodeLength - 1);
    return String(Math.floor(Math.random() * (max - min)) + min);
  }

  private isWithinCooldown(createdAt: Date) {
    return Date.now() - createdAt.getTime() < this.emailCodeCooldownSeconds * 1000;
  }

  private safeTruncate(value: string | undefined, maxLen: number) {
    if (!value) return undefined;
    return value.slice(0, maxLen);
  }

  private async getLatestValidCode(email: string): Promise<email_login_codes | null> {
    return this.prisma.email_login_codes.findFirst({
      where: {
        email,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  private generateDefaultNameByEmail(email: string) {
    const emailPrefix = email.split('@')[0]?.trim() ?? '';
    const baseName = emailPrefix || `用户${nanoid(6)}`;
    return baseName.slice(0, 20);
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
