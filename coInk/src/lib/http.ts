'use client';

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

// 后端统一响应包裹（code/message/data + token 字段）。
export type ApiEnvelope<T = unknown> = {
  code?: string | number;
  message?: string;
  data?: T;
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
};

// 扩展 axios 请求配置，用于标记重试与跳过刷新逻辑。
type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

// 从环境变量注入 API 基础地址（仅客户端可用）。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

// 主 HTTP 客户端：业务请求统一走这里。
const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 刷新 token 专用客户端，避免递归触发拦截器。
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isBrowser = typeof window !== 'undefined';

// token 与用户信息的本地存储助手（仅浏览器端）。
export const authUtils = {
  setTokens(accessToken: string, refreshToken: string) {
    if (!isBrowser) return;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  },
  clearTokens() {
    if (!isBrowser) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
  getAccessToken() {
    if (!isBrowser) return null;
    return localStorage.getItem('access_token');
  },
  getRefreshToken() {
    if (!isBrowser) return null;
    return localStorage.getItem('refresh_token');
  },
  isAuthenticated() {
    if (!isBrowser) return false;
    return !!localStorage.getItem('access_token');
  },
  // 保存用户信息快照，便于客户端读取。
  setUser(userInfo: unknown) {
    if (!isBrowser) return;
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
  },
  getUser<T = unknown>() {
    if (!isBrowser) return null;
    const userStr = localStorage.getItem('userInfo');
    try {
      return userStr ? (JSON.parse(userStr) as T) : null;
    } catch (error) {
      console.error('Failed to parse user info:', error);
      return null;
    }
  },
  clearUser() {
    if (!isBrowser) return;
    localStorage.removeItem('userInfo');
  },
};

// 判断接口响应是否成功（兼容 code 为字符串或数字）。
const isSuccessCode = (code: ApiEnvelope['code']) => {
  if (code === undefined || code === null) return true;
  return String(code) === '1' || String(code).toLowerCase() === 'success';
};

// 从响应包裹中提取 access/refresh token。
const getTokensFromEnvelope = (envelope: ApiEnvelope | null | undefined) => {
  if (!envelope) return null;
  const accessToken = envelope.accessToken ?? envelope.access_token;
  const refreshToken = envelope.refreshToken ?? envelope.refresh_token;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
};

// 单飞刷新：避免并发请求同时刷新 token。
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = authUtils.getRefreshToken();
    if (!refreshToken) return null;

    try {
      // 刷新接口应返回新的 access/refresh token。
      const response = await refreshClient.post<ApiEnvelope>('/auth/refresh', {
        refreshToken,
      });
      const tokens = getTokensFromEnvelope(response.data);
      if (!tokens) return null;
      authUtils.setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// 请求拦截器：注入 Bearer token，并为 GET 添加时间戳防缓存。
http.interceptors.request.use(
  (config) => {
    const token = authUtils.getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    if (config.method?.toLowerCase() === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  },
);

// 响应拦截器：统一处理接口 code 与 HTTP 错误。
http.interceptors.response.use(
  (response) => {
    if (response.status !== 200) {
      toast.error('Server error');
      return Promise.reject(response);
    }

    const data = response.data as ApiEnvelope | undefined;
    if (data && typeof data === 'object' && 'code' in data) {
      if (!isSuccessCode(data.code)) {
        toast.error(data.message || 'Request failed');
        return Promise.reject(response);
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalConfig = error.config as RetryConfig | undefined;

    // 401：仅重试一次刷新 token（避免死循环）。
    if (
      status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !originalConfig._skipAuthRefresh
    ) {
      originalConfig._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalConfig.headers = originalConfig.headers ?? {};
        originalConfig.headers.Authorization = newToken.startsWith('Bearer ')
          ? newToken
          : `Bearer ${newToken}`;
        return http(originalConfig);
      }

      // 刷新失败：清理本地状态并跳转登录页。
      authUtils.clearTokens();
      authUtils.clearUser();
      if (isBrowser) {
        window.location.href = '/auth';
      }
      return Promise.reject(error);
    }

    // 全局 HTTP 错误提示，保持用户可感知。
    if (error.response) {
      switch (error.response.status) {
        case 403:
          toast.error('Access denied');
          break;
        case 404:
          toast.error('Resource not found');
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          toast.error('Server error, please try again later');
          break;
        default:
          toast.error(`Unexpected error: ${error.response.status}`);
          break;
      }
    } else if (error.request) {
      toast.error('Network error, unable to reach server');
    } else {
      toast.error('Request configuration error');
    }

    return Promise.reject(error);
  },
);

export default http;
