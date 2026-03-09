'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Github,
  Calendar,
  Users,
  FileText,
  User as ProfileIcon,
  User as UserIcon,
  Newspaper,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { UserProfileProvider } from './_components/user-profile-context';

import { User } from '@/services/users/types';
import UserAvatar from '@/components/ui/user-avatar';
import { useUserQuery, getLocalUserData } from '@/hooks/useUserQuery';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';

// 导航菜单配置
const navigationItems = [
  {
    key: '/dashboard/user',
    label: '个人资料',
    icon: ProfileIcon,
    description: '管理个人信息和设置',
  },
  {
    key: '/dashboard/user/friend',
    label: '朋友',
    icon: Users,
    description: '管理朋友列表和关系',
  },
  {
    key: '/dashboard/user/docs',
    label: '共享文档',
    icon: FileText,
    description: '查看和管理共享文档',
  },
  {
    key: '/dashboard/user/blogs',
    label: '博客',
    icon: Newspaper,
    description: '查看和管理博客',
  },
];

// 用户信息头部组件
function UserProfileHeader({ user }: { user: User }) {
  const avatarUploadMutation = useAvatarUpload();

  // 处理头像上传
  const handleAvatarUpload = async (file: File) => {
    avatarUploadMutation.mutate(file, {
      onSuccess: () => {
        toast.success('头像更新成功');
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 overflow-hidden"
    >
      <div className="relative bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-green-600/20 backdrop-blur-sm"></div>
        <div className="relative">
          {/* 头像和基本信息 */}
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* 头像 */}
            <UserAvatar
              user={user}
              size="xl"
              editable
              onUpload={handleAvatarUpload}
              isUploading={avatarUploadMutation.isPending}
            />

            {/* 用户信息 */}
            <div className="text-gray-600 flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {user.name || '未设置姓名'}
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="flex items-center justify-center md:justify-start gap-2 text-white/90">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user.email || '未绑定邮箱'}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-white/90">
                  <UserIcon className="w-4 h-4" />
                  <span className="text-sm">{user.role || 'USER'}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-white/90">
                  <Github className="w-4 h-4" />
                  {user.githubUsername ? (
                    <a
                      href={`https://github.com/${user.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline hover:text-white transition-colors"
                    >
                      @{user.githubUsername}
                    </a>
                  ) : user.githubId ? (
                    <span className="text-sm">已绑定</span>
                  ) : (
                    <span className="text-sm">未绑定</span>
                  )}
                </div>
              </div>
              {user.createdAt && (
                <div className="flex items-center justify-center md:justify-start gap-2 text-white/70 mt-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// 导航组件
function UserNavigation() {
  const pathname = usePathname();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden"
    >
      <div className="px-6 py-4">
        <div className="flex items-center gap-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.key;
            const Icon = item.icon;

            return (
              <Link key={item.key} href={item.key}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                    isActive
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-emerald-50 border border-emerald-200 rounded-xl -z-10"
                      initial={false}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// 骨架屏组件
function UserLayoutSkeleton() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* 头部骨架 */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        <div className="relative bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-full bg-white/20 animate-pulse"></div>
            <div className="flex-1 space-y-3">
              <div className="h-8 w-48 bg-white/20 rounded animate-pulse mx-auto md:mx-0"></div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-5 w-24 bg-white/20 rounded animate-pulse mx-auto md:mx-0"
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 导航骨架 */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50">
        <div className="px-6 py-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-2.5 rounded-xl flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域骨架 */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 p-8">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 错误状态组件
function UserLayoutError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">无法加载用户资料</h2>
          <p className="text-gray-600 mb-2">{error.message || '请尝试刷新页面或重新登录'}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onRetry}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-medium"
          >
            重试
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium"
          >
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [localUserData, setLocalUserData] = useState<User | undefined>(undefined);

  // 获取用户数据
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error, refetch } = useUserQuery();

  // 确保组件只在客户端渲染，并预加载本地数据
  useEffect(() => {
    setIsMounted(true);

    const cachedData = getLocalUserData(queryClient);

    if (cachedData) {
      setLocalUserData(cachedData);
    }
  }, [queryClient]);

  // 在客户端挂载之前显示骨架屏
  if (!isMounted) {
    return <UserLayoutSkeleton />;
  }

  // 优先使用服务器数据，回退到本地数据
  const displayProfile = profile || localUserData;

  // 如果有错误且没有数据，显示错误状态
  if (error && !displayProfile) {
    return <UserLayoutError error={error} onRetry={refetch} />;
  }

  // 如果没有用户数据且正在加载，显示骨架屏
  if (!displayProfile && isLoading) {
    return <UserLayoutSkeleton />;
  }

  // 如果没有用户数据，显示骨架屏（兜底）
  if (!displayProfile) {
    return <UserLayoutSkeleton />;
  }

  return (
    <UserProfileProvider user={displayProfile} isLoading={isLoading} error={error}>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* 用户信息头部 */}
        <UserProfileHeader user={displayProfile} />

        {/* 导航菜单 */}
        <UserNavigation />

        {/* 子页面内容 */}
        <AnimatePresence mode="wait">
          <motion.div
            key="user-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </UserProfileProvider>
  );
}
