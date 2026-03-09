'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

import { useGitHubCallback } from '@/hooks/useAuth';

function CallbackContent() {
  const [status, setStatus] = useState('处理中...');
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [mounted, setMounted] = useState(false);
  const [authProcessed, setAuthProcessed] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const githubCallbackMutation = useGitHubCallback();

  // 确保组件在客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 获取重定向 URL
  const getRedirectUrl = (): string => {
    const redirectTo = searchParams?.get('redirect_to');

    if (redirectTo) {
      try {
        return decodeURIComponent(redirectTo);
      } catch {}
    }

    // 从 sessionStorage 获取
    if (mounted && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('auth_redirect');
        if (saved) {
          sessionStorage.removeItem('auth_redirect');
          return saved;
        }
      } catch {}
    }

    return '/dashboard';
  };

  useEffect(() => {
    if (!mounted || authProcessed || !searchParams) return;

    const processAuth = async () => {
      setAuthProcessed(true);

      const statusParam = searchParams.get('status');
      const redirectUrl = getRedirectUrl();

      // GitHub OAuth 登录成功
      if (statusParam === 'ok') {
        setStatus('登录成功，正在获取用户信息...');

        githubCallbackMutation.mutate(
          { redirectUrl },
          {
            onSuccess: () => {
              setStatus('登录成功，正在跳转...');
              setState('success');
            },
            onError: (error) => {
              const message = error instanceof Error ? error.message : String(error);
              setStatus(`获取用户信息失败: ${message}`);
              setState('error');
            },
          },
        );
        return;
      }

      // GitHub OAuth 登录失败
      if (statusParam === 'fail') {
        const reason = searchParams.get('reason');
        setStatus(
          reason === 'bad_state' ? '安全校验失败，请重新登录' : 'GitHub 授权失败，请重新登录',
        );
        setState('error');
        return;
      }

      // 未知状态
      setStatus('登录状态异常，请重新登录');
      setState('error');
    };

    processAuth();
  }, [mounted, authProcessed, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-full max-w-md p-10 space-y-6 bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">GitHub认证</h1>

          <div className="flex flex-col items-center justify-center space-y-4 mt-6">
            {state === 'loading' && (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-700">{status}</p>
              </div>
            )}

            {state === 'success' && (
              <div className="flex flex-col items-center">
                <CheckCircle className="h-14 w-14 text-green-500 mb-4" />
                <p className="text-lg font-medium text-gray-700">{status}</p>
              </div>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center">
                <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
                <p className="text-lg font-medium text-gray-700 text-center mb-4">{status}</p>
                <button
                  className="py-2.5 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-all duration-200 cursor-pointer"
                  onClick={() => router.push('/auth')}
                >
                  返回登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="w-full max-w-md p-10 space-y-6 bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">GitHub认证</h1>
              <div className="flex flex-col items-center justify-center mt-6">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-700">加载中...</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
