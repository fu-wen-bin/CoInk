/**
 * 认证相关的公共类型定义
 * @deprecated 请使用 @/services/auth/types 或 @/services/users/types 中的类型
 */

// 用户信息接口（旧格式，用于兼容）
export interface User {
  /** @deprecated 使用 userId (string) 替代 */
  id: number;
  name: string;
  /** @deprecated 使用 avatarUrl 替代 */
  avatar_url: string;
  bio?: string | null;
  company?: string | null;
  created_at: string;
  email?: string | null;
  github_id?: string | null;
  is_active: boolean;
  last_login_at: string;
  location?: string | null;
  role: string;
  updated_at: string;
  /** @deprecated 使用 websiteUrl 替代 */
  website_url?: string | null;
  preferences?: any | null;
}

// Token刷新响应接口 - 与后端DTO保持一致
export interface TokenRefreshResponse {
  token: string;
  refresh_token: string;
  expires_in: number; // 毫秒
  refresh_expires_in: number; // 毫秒
}

// 认证响应接口
export interface AuthResponse {
  token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  user?: User; // 可选，某些场景下（如从URL参数恢复token）可能没有user数据
}

// 发送验证码响应接口
export interface SendCodeResponse {
  success: boolean;
  message: string;
}

// 邮箱验证码登录参数
export interface EmailCodeLoginParams {
  email: string;
  code: string;
}

// 邮箱密码登录参数
export interface EmailPasswordLoginParams {
  email: string;
  password: string;
}

// 邮箱密码注册参数
export interface EmailPasswordRegisterParams {
  email: string;
  password: string;
  confirmPassword: string;
  // 前端本地重定向用，可选，不会传给后端
  redirectUrl?: string;
}
