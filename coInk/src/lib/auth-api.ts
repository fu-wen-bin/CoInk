'use client';

import http, { ApiEnvelope, authUtils } from '@/lib/http';

// 登录接口请求体
export type LoginRequest = {
  email: string;
  password: string;
};

// 注册接口请求体
export type RegisterRequest = {
  email: string;
  name: string;
  password: string;
};

// 标准化 token 结构，便于本地存储
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

// 兼容不同字段命名的 token 提取逻辑
const extractTokens = (payload: ApiEnvelope | null | undefined): AuthTokens | null => {
  if (!payload) return null;
  const accessToken = payload.accessToken ?? payload.access_token;
  const refreshToken = payload.refreshToken ?? payload.refresh_token;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
};

// 登录：请求后端并在响应中发现 token 则写入本地
export const login = async (payload: LoginRequest) => {
  const response = await http.post<ApiEnvelope>('/auth/login', payload);
  const tokens = extractTokens(response.data);
  if (tokens) {
    authUtils.setTokens(tokens.accessToken, tokens.refreshToken);
  }
  return response.data;
};

// 注册：请求后端并在响应中发现 token 则写入本地
export const register = async (payload: RegisterRequest) => {
  const response = await http.post<ApiEnvelope>('/auth/register', payload);
  const tokens = extractTokens(response.data);
  if (tokens) {
    authUtils.setTokens(tokens.accessToken, tokens.refreshToken);
  }
  return response.data;
};

// 退出登录：清理本地 token 与用户信息
export const logout = () => {
  authUtils.clearTokens();
  authUtils.clearUser();
};
