/**
 * 退出登录工具函数
 * 提供统一的登出逻辑，可在 React 组件外使用
 *
 * 执行流程：
 * 1. 调用后端 /auth/logout 接口清除 HTTP-Only Cookie 中的双 token
 * 2. 清理本地存储的用户信息
 * 3. 清理前端登录标记
 * 4. 可选：执行回调函数（如页面跳转）
 */

import { clearLoggedInFlag } from './cookie';

import { authApi } from '@/services/auth';

// 用户信息本地存储 key（与 useUserQuery.ts、useAuth.ts 保持一致）
const USER_STORAGE_KEY = 'cached_user_profile';

/**
 * 清除本地存储的用户信息
 */
const clearUserFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear user from localStorage:', error);
  }
};

/**
 * 退出登录选项
 */
interface LogoutOptions {
  /** 是否在成功后跳转到指定路径 */
  redirectTo?: string;
  /** 自定义成功回调 */
  onSuccess?: () => void;
  /** 自定义错误回调 */
  onError?: (error: Error) => void;
}

/**
 * 执行退出登录
 * 调用后端接口清除 HTTP-Only Cookie，并清理所有前端缓存
 *
 * @param options - 可选配置
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * // 基础使用
 * await logout();
 *
 * // 带跳转
 * await logout({ redirectTo: '/auth' });
 *
 * // 带回调
 * await logout({
 *   onSuccess: () => console.log('登出成功'),
 *   onError: (error) => console.error('登出失败', error)
 * });
 * ```
 */
export async function logout(options: LogoutOptions = {}): Promise<void> {
  const { redirectTo, onSuccess, onError } = options;

  try {
    // 1. 调用后端接口清除 HTTP-Only Cookie 中的双 token
    const { error } = await authApi.logout();

    if (error) {
      throw new Error(error);
    }

    // 2. 清理本地存储的用户信息
    clearUserFromStorage();

    // 3. 清理前端登录标记
    clearLoggedInFlag();

    // 4. 执行成功回调
    onSuccess?.();

    // 5. 执行跳转
    if (redirectTo && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  } catch (error) {
    console.error('Logout failed:', error);
    onError?.(error as Error);
    throw error;
  }
}

/**
 * 同步版本的登出（仅清理前端状态，不调用后端接口）
 * 用于紧急清理或已知后端已失效的场景
 */
export function logoutSync(options: Omit<LogoutOptions, 'onError'> = {}): void {
  const { redirectTo, onSuccess } = options;

  // 清理本地存储
  clearUserFromStorage();

  // 清理登录标记
  clearLoggedInFlag();

  // 执行回调
  onSuccess?.();

  // 执行跳转
  if (redirectTo && typeof window !== 'undefined') {
    window.location.href = redirectTo;
  }
}

/**
 * 检查是否需要重新登录（token 是否即将过期）
 * 由于使用 HTTP-Only Cookie，前端无法直接读取 token
 * 此方法仅作为占位，实际验证应通过调用 /auth/verify 接口
 */
export function shouldRefreshToken(): boolean {
  // HTTP-Only Cookie 方案下，前端无法直接判断 token 过期时间
  // 实际刷新逻辑由 request 拦截器在收到 401 时自动处理
  return false;
}
