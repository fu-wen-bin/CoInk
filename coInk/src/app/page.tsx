'use client';
import React, { useEffect, useState } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import Header from '@/components/homepage/Header';
import Hero from '@/components/homepage/Hero';

const BackgroundEffects = dynamic(() => import('@/components/homepage/BackgroundEffects'), {
  loading: () => null,
  ssr: false,
});

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 700 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

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

  function handleLogout() {}

  const handleGetStarted = () => {
    if (isLoggedIn) {
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
      <Header isLoggedIn={isLoggedIn} onGetStarted={handleGetStarted} onLogout={handleLogout} />

      {/*Hero Section - 现在作为header的兄弟元素，而不是嵌套在内部*/}
      <Hero isMounted={isMounted} isLoggedIn={isLoggedIn} onGetStarted={handleGetStarted} />
    </div>
  );
}
