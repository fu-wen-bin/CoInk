/**
 * 认证服务类型定义
 *
 * 功能说明：
 * - 用户注册、登录、登出
 * - Token 刷新与验证
 * - 用户信息管理（获取、更新、修改密码）
 * - GitHub OAuth 登录
 *
 * 后端接口文档：backEnd/docs/API.md
 */

/**
 * 基础用户信息
 * 与 @/services/users/types 中的 User 保持兼容
 */
export interface User {
  /** 用户ID */
  userId: string;
  /** 邮箱地址 */
  email: string;
  /** 用户名 */
  name: string;
  /** 头像URL */
  avatarUrl?: string | null;
  /** 个人简介 */
  bio?: string | null;
  /** 所在公司 */
  company?: string | null;
  /** 所在地区 */
  location?: string | null;
  /** 个人网站 */
  websiteUrl?: string | null;
  /** GitHub用户ID */
  githubId?: string | null;
  /** GitHub用户名 */
  githubUsername?: string | null;
  /** 用户角色 */
  role?: string;
  /** 是否激活 */
  isActive?: boolean;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 最后登录时间 */
  lastLoginAt?: string | null;
}

/**
 * 注册请求参数
 */
export interface RegisterParams {
  /** 邮箱地址 */
  email: string;
  /** 用户名 */
  name: string;
  /** 密码 */
  password: string;
}

/**
 * 登录请求参数
 */
export interface LoginParams {
  /** 邮箱地址 */
  email: string;
  /** 密码 */
  password: string;
}

/**
 * 发送邮箱验证码请求参数
 */
export interface SendEmailCodeParams {
  /** 邮箱地址 */
  email: string;
}

/**
 * 邮箱验证码登录请求参数
 */
export interface EmailCodeLoginParams {
  /** 邮箱地址 */
  email: string;
  /** 6位验证码 */
  code: string;
}

/**
 * GitHub OAuth 登录请求参数
 */
export interface GithubLoginParams {
  /** GitHub 授权码 */
  code: string;
}

/**
 * 刷新 Token 请求参数
 */
export interface RefreshTokenParams {
  /** 刷新令牌 */
  refreshToken: string;
}

/**
 * 登出请求参数
 */
export interface LogoutParams {
  /** 用户ID */
  userId: string;
}

/**
 * 更新用户资料请求参数
 */
export interface UpdateProfileParams {
  /** 用户名 */
  name?: string;
  /** 邮箱地址 */
  email?: string;
  /** 头像URL */
  avatarUrl?: string;
  /** 个人简介 */
  bio?: string;
  /** 所在公司 */
  company?: string;
  /** 所在地区 */
  location?: string;
  /** 个人网站 */
  websiteUrl?: string;
}

/**
 * 修改密码请求参数
 */
export interface ChangePasswordParams {
  /** 旧密码 */
  oldPassword: string;
  /** 新密码 */
  newPassword: string;
}

/**
 * 认证响应数据
 */
export interface AuthResponseData {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 是否为首次注册用户 */
  isNewUser?: boolean;
  /** 用户信息 */
  user: User;
}

/**
 * 发送验证码响应数据
 */
export interface SendEmailCodeResponseData {
  /** 是否成功 */
  success: boolean;
  /** 冷却秒数 */
  cooldownSeconds: number;
}

/**
 * Token 验证响应数据
 */
export interface VerifyTokenResponseData {
  /** 是否有效 */
  valid: boolean;
  /** Token 载荷信息 */
  payload: {
    /** 用户ID */
    userId: string;
    /** 邮箱地址 */
    email: string;
  };
}

/**
 * 用户资料响应数据
 */
export type ProfileResponseData = User;

/**
 * 通用成功响应数据
 */
export interface SuccessResponseData {
  /** 是否成功 */
  success: boolean;
}

/**
 * Token 刷新响应数据
 */
export interface TokenRefreshResponseData {
  /** 新的访问令牌 */
  accessToken: string;
  /** 新的刷新令牌 */
  refreshToken: string;
}
