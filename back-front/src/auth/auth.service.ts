import { Injectable } from '@nestjs/common';

import {
  GithubLoginDto,
  GithubUserDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';

@Injectable()
export class AuthService {
  // ==================== 邮箱密码认证 ====================

  register(registerDto: RegisterDto) {
    // TODO: 实现邮箱密码注册逻辑
    // 1. 检查邮箱是否已存在
    // 2. 使用 argon2 哈希密码
    // 3. 生成 userId (nanoId)
    // 4. 创建用户记录
    // 5. 生成 JWT Token
    console.log('Registering user with data:', registerDto);
    return 'This action registers a new user';
  }

  login(loginDto: LoginDto) {
    // TODO: 实现邮箱密码登录逻辑
    // 1. 根据邮箱查找用户
    // 2. 验证密码
    // 3. 更新 lastLoginAt
    // 4. 生成 JWT Token
    console.log('Logging in user with data:', loginDto);
    return 'This action logs in a user';
  }

  // ==================== GitHub OAuth 认证 ====================

  githubLogin(githubLoginDto: GithubLoginDto) {
    // TODO: 实现 GitHub OAuth 登录逻辑
    // 1. 使用 code 换取 access_token
    // 2. 获取 GitHub 用户信息
    // 3. 查找或创建用户
    // 4. 更新 lastLoginAt
    // 5. 生成 JWT Token
    console.log('GitHub login with code:', githubLoginDto.code);
    return 'This action handles GitHub OAuth login';
  }

  findOrCreateGithubUser(githubUserDto: GithubUserDto) {
    // TODO: 实现查找或创建 GitHub 用户逻辑
    console.log('Finding or creating GitHub user:', githubUserDto);
    return 'This action finds or creates a GitHub user';
  }

  // ==================== Token 管理 ====================

  refreshToken(refreshTokenDto: RefreshTokenDto) {
    // TODO: 实现刷新 Token 逻辑
    // 1. 验证 refreshToken
    // 2. 生成新的 accessToken
    console.log('Refreshing token:', refreshTokenDto.refreshToken);
    return 'This action refreshes the access token';
  }

  validateToken(token: string) {
    // TODO: 实现验证 Token 逻辑
    return `This action validates token: ${token}`;
  }

  // ==================== 用户信息 ====================

  getProfile(userId: string) {
    // TODO: 实现获取用户信息逻辑
    return `This action returns profile for user #${userId}`;
  }

  updateProfile(userId: string, updateAuthDto: UpdateAuthDto) {
    // TODO: 实现更新用户信息逻辑
    console.log('Updating profile with data:', updateAuthDto);
    return `This action updates profile for user #${userId}`;
  }

  // ==================== 密码管理 ====================

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  changePassword(userId: string, oldPassword: string, newPassword: string) {
    // TODO: 实现修改密码逻辑
    // 1. 验证旧密码 (oldPassword)
    // 2. 哈希新密码 (newPassword)
    // 3. 更新密码
    return `This action changes password for user #${userId}`;
  }

  resetPassword(email: string) {
    // TODO: 实现重置密码逻辑
    // 1. 生成重置 Token
    // 2. 发送重置邮件
    return `This action sends password reset email to: ${email}`;
  }
}
