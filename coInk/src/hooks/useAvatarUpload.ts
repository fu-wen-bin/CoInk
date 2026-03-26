import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getLocalUserData, userQueryKeys } from './useUserQuery';

import { formatFileSize } from '@/utils/format/file-size';
import { uploadService } from '@/services/upload';
import type { User } from '@/services/users/types';
import { toastError } from '@/utils/toast';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function useAvatarUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('请上传图片文件');
      }

      if (file.size > AVATAR_MAX_BYTES) {
        throw new Error(`头像图片大小不能超过 ${formatFileSize(AVATAR_MAX_BYTES)}`);
      }

      // 上传图片获取URL
      const imageUrl = await uploadService.uploadAvatar(file);

      return { imageUrl };
    },
    onMutate: async (file) => {
      // 创建预览URL进行乐观更新
      const previewUrl = URL.createObjectURL(file);

      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: userQueryKeys.profile() });

      // 获取当前用户数据
      const previousUser =
        queryClient.getQueryData<User>(userQueryKeys.profile()) ?? getLocalUserData(queryClient);

      // 乐观更新 - 立即显示预览
      if (previousUser) {
        queryClient.setQueryData<User>(userQueryKeys.profile(), {
          ...previousUser,
          avatarUrl: previewUrl,
        });
      }

      return { previousUser, previewUrl };
    },
    onSuccess: async (data, file, context) => {
      // 清理预览URL
      if (context?.previewUrl) {
        URL.revokeObjectURL(context.previewUrl);
      }

      // 后端 upload/avatar 已写库，这里同步前端缓存与本地存储
      queryClient.setQueriesData<User | undefined>({ queryKey: userQueryKeys.profile() }, (old) =>
        old ? { ...old, avatarUrl: data.imageUrl } : old,
      );

      const local = getLocalUserData(queryClient);
      if (local) {
        const nextLocal = { ...local, avatarUrl: data.imageUrl };
        localStorage.setItem('cached_user_profile', JSON.stringify(nextLocal));
      }
    },
    onError: (error, file, context) => {
      // 清理预览URL
      if (context?.previewUrl) {
        URL.revokeObjectURL(context.previewUrl);
      }

      // 回滚到之前的数据
      if (context?.previousUser) {
        queryClient.setQueryData(userQueryKeys.profile(), context.previousUser);
      }

      console.error('头像上传失败:', error);
      toastError(error instanceof Error ? error.message : '头像上传失败');
    },
  });
}
