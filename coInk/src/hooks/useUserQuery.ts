import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { toastError, toastSuccess } from '@/utils/toast';
import { authApi } from '@/services/auth';
import UserApi from '@/services/users';
import type { User } from '@/services/users/types';
import { clearLoggedInFlag, isLoggedIn } from '@/utils/auth/cookie';

/**
 * User Query Keys
 * 集中管理用户相关的查询键
 */
export const userQueryKeys = {
  all: ['user'] as const,
  profile: () => [...userQueryKeys.all, 'profile'] as const,
};

/**
 * LocalStorage 持久化工具
 */
const USER_STORAGE_KEY = 'cached_user_profile';

const storage = {
  get: (): User | null => {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      return cached ? (JSON.parse(cached) as User) : null;
    } catch {
      return null;
    }
  },
  set: (user: User) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to cache user profile:', error);
    }
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_STORAGE_KEY);
  },
};

/**
 * 获取当前用户信息
 * 支持本地缓存和自动持久化
 *
 * 说明：由于后端没有 /auth/me 接口，使用以下策略：
 * 1. 首先尝试从本地缓存获取
 * 2. 如果缓存不存在，返回 null（等待其他方式获取用户ID后再查）
 *
 * 如需获取用户信息，请使用 authApi.verifyToken() 或 authApi.getProfile(userId)
 */
export function useUserQuery(userId?: string) {
  return useQuery({
    queryKey: [...userQueryKeys.profile(), userId],
    queryFn: async (): Promise<User | null> => {
      // 如果没有 userId，尝试从本地缓存获取
      if (!userId) {
        return storage.get();
      }

      const { data, error } = await authApi.getProfile(userId);

      if (error || !data?.data) {
        throw new Error(error || 'Failed to fetch user');
      }

      const user = data.data as User;

      // 自动持久化到本地存储
      storage.set(user);

      return user;
    },
    // 使用本地缓存作为占位数据，实现无缝加载
    placeholderData: () => storage.get() ?? undefined,
    enabled: isLoggedIn() && (!!userId || !!storage.get()), // 仅在已登录且有 userId 或缓存时查询
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 30 * 60 * 1000, // 30分钟
  });
}

/**
 * 获取缓存的用户数据
 */
export function getLocalUserData(queryClient: ReturnType<typeof useQueryClient>): User | undefined {
  // useUserQuery 使用的 queryKey 是 [...userQueryKeys.profile(), userId]
  // 当 userId 为 undefined 时，key 为 ['user', 'profile', undefined]
  return (
    queryClient.getQueryData<User>([...userQueryKeys.profile(), undefined]) ??
    storage.get() ??
    undefined
  );
}

// 更新用户信息的 mutation hook
export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<User> & { userId: string }) => {
      return await UserApi.updateUser(updates);
    },
    onMutate: async (updates) => {
      // 取消正在进行的查询以避免冲突
      await queryClient.cancelQueries({ queryKey: userQueryKeys.profile() });

      // 获取当前用户数据
      const previousUser = queryClient.getQueryData<User>(userQueryKeys.profile());

      // 乐观更新 - 立即更新缓存
      if (previousUser) {
        queryClient.setQueryData<User>(userQueryKeys.profile(), {
          ...previousUser,
          ...updates,
        });
      }

      // 返回回滚数据
      return { previousUser };
    },
    onError: (error, _variables, context) => {
      // 回滚到之前的数据
      if (context?.previousUser) {
        queryClient.setQueryData(userQueryKeys.profile(), context.previousUser);
      }

      console.error('更新用户信息失败:', error);
      toastError('更新失败，请重试');
    },
    onSuccess: (_data, variables) => {
      // 成功后重新获取最新数据
      queryClient.invalidateQueries({ queryKey: userQueryKeys.profile() });

      const updatedFieldsCount = Object.keys(variables).length;
      toastSuccess(`已更新 ${updatedFieldsCount} 个字段`);
    },
  });
}

/**
 * 登出 Mutation
 * 调用后端接口清除 HTTP-Only Cookie，并清理所有前端缓存数据
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // 清理 React Query 缓存
      queryClient.removeQueries({ queryKey: userQueryKeys.all });

      // 清理本地存储的用户信息
      storage.clear();

      // 清理前端登录标记 Cookie
      clearLoggedInFlag();

      toastSuccess('已成功退出登录');

      // 使用 Next.js router 跳转到登录页
      router.push('/auth');
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      toastError('退出登录失败，请重试');
    },
  });
}
