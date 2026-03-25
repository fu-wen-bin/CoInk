import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { userQueryKeys } from './useUserQuery';

import { toastSuccess, toastError, toastWarning } from '@/utils/toast';
import { authApi } from '@/services/auth';
import type { AuthResponseData, User } from '@/services/auth/types';
import { setLoggedInFlag } from '@/utils/auth/cookie';

// 邮箱验证码登录参数（扩展）
interface EmailLoginParams {
  email: string;
  code: string;
  redirectUrl?: string;
}

// GitHub 回调参数
interface GitHubCallbackParams {
  code: string;
}

// 用户信息本地存储 key（与 useUserQuery.ts 保持一致）
const USER_STORAGE_KEY = 'cached_user_profile';

/**
 * 保存用户到本地存储
 */
const saveUserToStorage = (user: User) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Failed to save user to localStorage:', error);
  }
};

// 通用的登录成功处理函数
const handleAuthSuccess = async (
  authData: AuthResponseData,
  queryClient: ReturnType<typeof useQueryClient>,
  router: ReturnType<typeof useRouter>,
  redirectUrl?: string,
) => {
  console.log('✅ 登录成功，处理认证数据...');

  // 1. 设置登录标记（用于前端状态判断）
  // HTTP-Only Cookie 已由后端自动设置，前端只需设置 logged_in 标记
  setLoggedInFlag();
  console.log('💾 登录标记已设置');

  // 2. 获取用户资料
  try {
    console.log('👤 正在获取用户资料...');

    // 从 authData.user 中获取 userId
    const userId = authData.user?.userId;
    if (!userId) {
      console.error('❌ 无法获取用户ID');
      toastWarning('无法获取用户ID，但登录成功');
      return;
    }

    const { data: userResponse, error } = await authApi.getProfile(userId);

    if (error || !userResponse?.data) {
      console.error('❌ 获取用户资料失败:', error);
      toastWarning('获取用户资料失败，但登录成功');
    } else {
      const user = userResponse.data;
      console.log('✅ 用户资料获取成功:', user);

      // 3. 立即更新 React Query 缓存
      // 注意：useUserQuery 使用的 queryKey 是 [...userQueryKeys.profile(), userId]
      // 所以当 userId 为 undefined 时，key 为 ['user', 'profile', undefined]
      queryClient.setQueryData<User>([...userQueryKeys.profile(), undefined], user);

      // 4. 保存到 localStorage 用于持久化
      saveUserToStorage(user);
      console.log('💾 用户资料已缓存到本地');
    }
  } catch (error) {
    console.warn('⚠️ 处理用户资料时出错:', error);
    toastWarning('获取用户资料失败，但登录成功');
  }

  // 5. 跳转到目标页面
  const targetUrl = redirectUrl || '/dashboard';
  console.log('🚀 即将跳转到:', targetUrl);
  setTimeout(() => {
    router.push(targetUrl);
  }, 1000);
};

// 邮箱验证码登录 hook
/*
export function useEmailLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  console.log('🔧 useEmailLogin hook 初始化');

  return useMutation({
    mutationKey: ['email-login'],
    mutationFn: async (params: EmailLoginParams) => {
      console.log('🚀 [mutationFn] 开始执行 - 邮箱验证码登录');
      console.log('🚀 [mutationFn] 接收到的参数:', params);

      const { email, code, redirectUrl } = params;
      console.log('📧 邮箱验证码登录请求:', { email, code: code ? '***' : undefined, redirectUrl });

      try {
        console.log('🌐 开始调用 authApi.emailCodeLogin...');

        const { data, error } = await authApi.emailCodeLogin({ email, code });
        console.log('🌐 API 调用完成:', { hasData: !!data, hasError: !!error });

        if (error) {
          console.error('❌ 邮箱验证码登录 API 错误:', error);
          throw new Error(error);
        }

        if (!data || data.code !== 200) {
          console.error('❌ 邮箱验证码登录响应错误:', data);
          throw new Error(data?.message || '登录失败');
        }

        console.log('✅ 邮箱验证码登录成功, 返回数据');

        return { authData: data.data, redirectUrl };
      } catch (err) {
        console.error('❌ [mutationFn] 捕获到异常:', err);
        throw err;
      }
    },
    onMutate: (variables) => {
      console.log('🔄 [onMutate] mutation 开始执行, 参数:', variables);
    },
    onSuccess: async ({ authData, redirectUrl }) => {
      console.log('✅ [onSuccess] mutation 成功回调');
      toastSuccess('登录成功！');

      await handleAuthSuccess(authData, queryClient, router, redirectUrl);
    },
    onError: (error) => {
      console.error('❌ [onError] mutation 错误回调:', error);
      toastError(error instanceof Error ? error.message : '登录失败');
    },
    onSettled: (data, error) => {
      console.log('🏁 [onSettled] mutation 完成:', { hasData: !!data, hasError: !!error });
    },
  });
}
*/

// GitHub 登录 hook（用于直接传入 code 调用后端登录）
export function useGitHubLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ code, redirectUrl }: GitHubCallbackParams & { redirectUrl?: string }) => {
      const { data, error } = await authApi.githubLogin({ code });

      if (error) {
        throw new Error(error);
      }

      if (!data || data.code !== 200) {
        throw new Error(data?.message || 'GitHub登录失败');
      }

      return { authData: data.data, redirectUrl };
    },
    onSuccess: async ({ authData, redirectUrl }) => {
      toastSuccess('GitHub登录成功！');

      await handleAuthSuccess(authData, queryClient, router, redirectUrl);
    },
    onError: (error) => {
      console.error('GitHub登录失败:', error);
      toastError(error instanceof Error ? error.message : 'GitHub登录失败');
    },
  });
}

// GitHub 回调处理 hook（用于后端已设置 Cookie 的场景）
export function useGitHubCallback() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ redirectUrl }: { redirectUrl?: string }) => {
      // 后端已经设置了 HTTP-Only Cookie
      // 调用 verifyToken 验证 token 有效性并获取用户信息
      console.log('🔍 验证 GitHub 登录状态...');
      const { data: verifyData, error: verifyError } = await authApi.verifyToken();

      if (verifyError) {
        throw new Error(verifyError);
      }

      // 后端 verifyToken 返回格式: { code: 200, data: { valid: boolean, payload?: {...} } }
      if (!verifyData || verifyData.code !== 200 || !verifyData.data?.valid) {
        throw new Error('Token 验证失败');
      }

      const payload = verifyData.data.payload;
      if (!payload?.userId) {
        throw new Error('无法获取用户信息');
      }

      // 获取用户详细信息
      const { data: profileData, error: profileError } = await authApi.getProfile(payload.userId);

      if (profileError) {
        throw new Error(profileError);
      }

      // 后端 getProfile 返回格式: { code: 200, data: {...} }
      if (!profileData || profileData.code !== 200) {
        throw new Error('获取用户信息失败');
      }

      // 构造 AuthResponseData 格式
      const authData: AuthResponseData = {
        accessToken: '', // Cookie 中已设置，前端不需要直接使用
        refreshToken: '', // Cookie 中已设置
        user: {
          userId: profileData.data.userId,
          name: profileData.data.name,
          email: profileData.data.email,
        },
      };

      return { authData, redirectUrl };
    },
    onSuccess: async ({ authData, redirectUrl }) => {
      toastSuccess('GitHub登录成功！');

      await handleAuthSuccess(authData, queryClient, router, redirectUrl);
    },
    onError: (error: Error) => {
      console.error('GitHub回调处理失败:', error);
      toastError(error.message);
    },
  });
}

// 通用的 Token 登录 hook（用于直接 token 认证）
export function useTokenLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      authData,
      redirectUrl,
    }: {
      authData: AuthResponseData;
      redirectUrl?: string;
    }) => {
      return { authData, redirectUrl };
    },
    onSuccess: async ({ authData, redirectUrl }) => {
      toastSuccess('登录成功！');

      await handleAuthSuccess(authData, queryClient, router, redirectUrl);
    },
    onError: (error) => {
      console.error('Token登录失败:', error);
      toastError(error instanceof Error ? error.message : '登录失败');
    },
  });
}
