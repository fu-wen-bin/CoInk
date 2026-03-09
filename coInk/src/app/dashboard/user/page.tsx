'use client';

import { useUserProfile } from './_components/user-profile-context';
import UserProfileForm from './_components/user-profile-form';

export default function UserProfilePage() {
  const { user, isLoading } = useUserProfile();

  // 如果用户数据正在加载中，显示简单加载状态
  // 实际骨架屏由 layout 提供，这里只是兜底
  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 如果没有用户数据，显示空状态
  // 这种情况理论上不会发生，因为 layout 已经处理了错误状态
  if (!user) {
    return null;
  }

  // 渲染用户资料表单
  return (
    <div className="space-y-8">
      <UserProfileForm user={user} />
    </div>
  );
}
