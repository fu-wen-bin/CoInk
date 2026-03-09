'use client';
import React, { useEffect, useState } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import Header from '@/components/homepage/Header';
import Hero from '@/components/homepage/Hero';
import { useLogoutMutation } from '@/hooks/useUserQuery';
import { isLoggedIn } from '@/utils/auth/cookie';

const BackgroundEffects = dynamic(() => import('@/components/homepage/BackgroundEffects'), {
  loading: () => null,
  ssr: false,
});

export default function Home() {
  const router = useRouter();
  const [isLoggedInState, setIsLoggedInState] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 使用登出 mutation，包含调用后端接口清除 HTTP-Only Cookie 的完整逻辑
  const logoutMutation = useLogoutMutation();

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 700 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  // 检查登录状态
  useEffect(() => {
    setIsMounted(true);
    const loggedIn = isLoggedIn();
    setIsLoggedInState(loggedIn);
  }, []);

  // 监听登出成功，更新本地登录状态
  useEffect(() => {
    if (logoutMutation.isSuccess) {
      setIsLoggedInState(false);
    }
  }, [logoutMutation.isSuccess]);

  // 鼠标移动效果 - 独立effect，避免不必要的重渲染
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX - 192);
      mouseY.set(e.clientY - 192);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [mouseX, mouseY]);

  /**
   * 处理退出登录
   * 调用 useLogoutMutation，它会：
   * 1. 调用后端 /auth/logout 接口清除 HTTP-Only Cookie 中的双 token
   * 2. 清理 React Query 缓存
   * 3. 清理 localStorage 中的用户信息
   * 4. 清理前端登录标记 Cookie
   * 5. 跳转到登录页
   */
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleGetStarted = () => {
    if (isLoggedInState) {
      router.push('/dashboard');
    } else {
      router.push('/auth');
    }
  };
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* 动态背景 */}
      <BackgroundEffects springX={springX} springY={springY} />

      {/* Header */}
      <Header
        isLoggedIn={isLoggedInState}
        onGetStarted={handleGetStarted}
        onLogout={handleLogout}
      />

      {/*Hero Section - 现在作为header的兄弟元素，而不是嵌套在内部*/}
      <Hero isMounted={isMounted} isLoggedIn={isLoggedInState} onGetStarted={handleGetStarted} />
    </div>
  );
}
