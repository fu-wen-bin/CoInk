'use client';

import React, { useEffect, Suspense, useState, FormEvent } from 'react';
import { Sparkles, Github, Eye, EyeOff } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { toastError, toastInfo, toastSuccess } from '@/utils/toast';
import { redirectManager } from '@/utils/redirect-manager';
import { useSimpleAuthForm } from '@/hooks/use-simple-auth-form';
import { LoginModeSwitcher, LoginMode } from '@/app/auth/_components/login-mode-switcher';
import { AuthBackground } from '@/app/auth/_components/auth-background';
import authApi from '@/services/auth';
import { userQueryKeys } from '@/hooks/useUserQuery';
import { setLoggedInFlag } from '@/utils/auth/cookie';
import type { User } from '@/services/auth/types';

// 用户信息本地存储 key（与 useUserQuery.ts、useAuth.ts 保持一致）
const USER_STORAGE_KEY = 'cached_user_profile';

const AUTH_REASON_MESSAGE_MAP: Record<string, string> = {
  auth_required: '当前页面需要登录后才能访问',
  document_login_required: '该文档受权限保护，请先登录后访问',
};

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

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [isLoading, setIsLoading] = useState(false);

  // 使用简化版表单 hook
  const {
    formData,
    updateField,
    errors,
    validateRegisterForm,
    validateLoginForm,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    countdown,
    isSendingCode,
    handleSendCode,
  } = useSimpleAuthForm();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 保存重定向 URL
  useEffect(() => {
    if (!mounted) return;

    const redirectUrl = redirectManager.get(searchParams);
    redirectManager.save(redirectUrl);
  }, [searchParams, mounted]);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const reason = searchParams?.get('reason');
    if (!reason) return;

    const message = AUTH_REASON_MESSAGE_MAP[reason] || '请先登录后继续操作';
    const redirectTo = searchParams?.get('redirect_to') || '';
    const noticeKey = `auth_reason_notice:${reason}:${redirectTo}`;

    if (window.sessionStorage.getItem(noticeKey)) {
      return;
    }

    toastInfo(message);
    window.sessionStorage.setItem(noticeKey, '1');
  }, [mounted, searchParams]);

  const handleGitHubLogin = () => {
    if (!mounted) return;

    const redirectUrl = redirectManager.get(searchParams);
    const baseUrl = `${process.env.NEXT_PUBLIC_SERVER_URL}/auth/github`;
    const authUrl =
      redirectUrl !== '/dashboard'
        ? `${baseUrl}?state=${encodeURIComponent(redirectUrl)}`
        : baseUrl;
    window.location.href = authUrl;
  };

  // 表单提交处理
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const redirectUrl = redirectManager.get(searchParams);
    console.log('当前登录模式：', loginMode);
    console.log('表单数据：', formData);

    setIsLoading(true);

    try {
      if (loginMode === 'password') {
        // 密码登录
        if (!validateLoginForm()) {
          setIsLoading(false);
          return;
        }

        const { data: response, error } = await authApi.login({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          toastError(error);
          setIsLoading(false);
          return;
        }

        if (!response || response.code !== 200) {
          toastError(response?.message || '登录失败，请重试');
          setIsLoading(false);
          return;
        }

        // HTTP-Only Cookie 已由后端自动设置
        setLoggedInFlag();

        // 保存用户数据到 React Query 缓存和 localStorage
        const authData = response.data;
        if (authData?.user) {
          // 1. 保存到 React Query 缓存
          queryClient.setQueryData<User>([...userQueryKeys.profile(), undefined], authData.user);
          // 2. 保存到 localStorage
          saveUserToStorage(authData.user);
          console.log('💾 用户资料已缓存:', authData.user);
        }

        toastSuccess('登录成功！');

        setTimeout(() => {
          router.push(redirectUrl || '/dashboard');
        }, 500);
      } else if (loginMode === 'email') {
        // 验证码登录
        if (!formData.email || !formData.code) {
          toastError('请输入邮箱和验证码');
          setIsLoading(false);
          return;
        }

        toastError('验证码登录功能暂未开放，请使用密码登录');
        setIsLoading(false);
      } else {
        // 注册
        console.log('注册模式，表单数据：', formData);

        if (!validateRegisterForm()) {
          setIsLoading(false);
          return;
        }

        const { data: response, error } = await authApi.register({
          email: formData.email,
          password: formData.password,
          name: formData.email.split('@')[0],
        });

        console.log('注册响应：', response, '错误信息：', error);

        if (error) {
          toastError(error);
          setIsLoading(false);
          return;
        }

        if (!response || response.code !== 200) {
          toastError(response?.message || '注册失败，请重试');
          setIsLoading(false);
          return;
        }

        if (response.data?.accessToken) {
          setLoggedInFlag();

          // 保存用户数据到 React Query 缓存和 localStorage
          if (response.data?.user) {
            queryClient.setQueryData<User>(
              [...userQueryKeys.profile(), undefined],
              response.data.user,
            );
            saveUserToStorage(response.data.user);
            console.log('💾 注册用户资料已缓存:', response.data.user);
          }

          toastSuccess('注册成功，已自动登录！');

          setTimeout(() => {
            router.push(redirectUrl || '/dashboard');
          }, 500);
        } else {
          toastSuccess('注册成功！请使用邮箱密码登录');
          setIsLoading(false);
        }
      }
    } catch (error) {
      toastError(error instanceof Error ? error.message : '操作失败，请重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-white">
      {/* 左侧：登录表单 */}
      <section className="flex-1 flex items-center justify-center px-4 py-8 sm:p-6 md:p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-5 md:gap-7">
            {/* 标题 */}
            <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
              <h1 className="text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-2 md:mb-2.5 text-gray-900">
                {loginMode === 'register' ? '创建账户' : '欢迎回来'}
              </h1>
              <p className="text-gray-600 text-base md:text-base leading-relaxed font-medium">
                {loginMode === 'register'
                  ? '加入我们，开启您的创作之旅'
                  : '登录您的账户，继续使用 CoInk 文档系统'}
              </p>
            </div>

            {/* 表单 */}
            <form className="space-y-3.5 md:space-y-4" onSubmit={handleSubmit}>
              {/* 邮箱输入 - 所有模式共用 */}
              <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">邮箱地址</label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="请输入您的邮箱地址"
                    className="w-full bg-gray-50 border border-gray-200 text-base px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder:text-gray-500"
                  />
                </div>
                {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* 密码登录表单 */}
              {loginMode === 'password' && (
                <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="请输入您的密码"
                      className="w-full bg-gray-50 border border-gray-200 text-base px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder:text-gray-500 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
              )}

              {/* 邮箱验证码表单 */}
              {loginMode === 'email' && (
                <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">验证码</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => updateField('code', e.target.value)}
                      placeholder="请输入6位验证码"
                      maxLength={6}
                      className="flex-1 bg-gray-50 border border-gray-200 text-base px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={isSendingCode || countdown > 0}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {countdown > 0 ? `${countdown}s` : isSendingCode ? '发送中...' : '获取验证码'}
                    </button>
                  </div>
                  {errors.code && <p className="mt-1.5 text-sm text-red-600">{errors.code}</p>}
                </div>
              )}

              {/* 注册表单 */}
              {loginMode === 'register' && (
                <>
                  <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">密码</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        placeholder="请输入您的密码"
                        className="w-full bg-gray-50 border border-gray-200 text-base px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder:text-gray-500 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>
                    )}
                  </div>

                  <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">
                      确认密码
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => updateField('confirmPassword', e.target.value)}
                        placeholder="请再次输入您的密码"
                        className="w-full bg-gray-50 border border-gray-200 text-base px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder:text-gray-500 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>
                </>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-gray-900 py-3.5 font-bold text-base md:text-base text-white hover:bg-gray-800 active:bg-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl animate-fade-in transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-gray-900 cursor-pointer"
                style={{ animationDelay: '600ms' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2 font-semibold">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>处理中...</span>
                  </span>
                ) : loginMode === 'register' ? (
                  '创建账户'
                ) : (
                  '登录'
                )}
              </button>
            </form>

            {/* 分隔线 */}
            <div
              className="relative flex items-center justify-center animate-fade-in"
              style={{ animationDelay: '700ms' }}
            >
              <span className="w-full border-t border-gray-200"></span>
              <span className="px-3 text-sm md:text-xs text-gray-500 bg-white absolute font-medium">
                或继续使用
              </span>
            </div>

            {/* GitHub 登录 */}
            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-300 rounded-xl py-3 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 animate-fade-in text-base shadow-sm"
              style={{ animationDelay: '800ms' }}
            >
              <Github className="w-5 h-5" />
              <span className="font-semibold text-gray-900">使用 GitHub 登录</span>
            </button>

            {/* 登录模式切换 - 底部显示 */}
            <LoginModeSwitcher currentMode={loginMode} onModeChange={setLoginMode} />
          </div>
        </div>
      </section>

      {/* 右侧：背景图片 + 评价 */}
      <AuthBackground />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col md:flex-row font-sans bg-white">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="w-12 h-12 animate-pulse mx-auto mb-4 text-violet-500" />
              <h1 className="text-3xl font-bold mb-3 text-gray-900 tracking-tight">欢迎回来</h1>
              <p className="text-base text-gray-600 font-medium">加载中...</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
