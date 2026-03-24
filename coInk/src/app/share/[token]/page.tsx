'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { documentsApi } from '@/services/documents';

type PageProps = {
  params: {
    token: string;
  };
};

const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const cached = localStorage.getItem('cached_user_profile');
    const parsed = cached ? (JSON.parse(cached) as { userId?: string }) : null;
    return parsed?.userId ?? '';
  } catch {
    return '';
  }
};

export default function ShareTokenPage({ params }: PageProps) {
  const router = useRouter();
  const token = useMemo(() => decodeURIComponent(params.token ?? '').trim(), [params.token]);

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('分享链接无效：缺少 token');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStatus('loading');

      const userId = getCurrentUserId();
      const { data, error } = await documentsApi.getByShareToken(token, { userId }, (err) => {
        // 这里交由页面统一展示错误
        if (process.env.NODE_ENV !== 'production') {
          console.error('share redirect error:', err);
        }
      });

      if (cancelled) return;

      if (error || !data?.data?.documentId) {
        setStatus('error');
        setErrorMessage(error || '分享链接已失效或您无权访问该文档');
        return;
      }

      const doc = data.data;
      const nextUrl =
        doc.linkPermission === 'view'
          ? `/docs/${doc.documentId}?readonly=true`
          : `/docs/${doc.documentId}`;

      router.replace(nextUrl);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-600 dark:text-gray-300">正在解析分享链接...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-white px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">无法打开分享链接</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{errorMessage}</p>

        <div className="mt-5 flex gap-3">
          <Link
            href="/docs"
            className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            返回文档页
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            去登录
          </Link>
        </div>
      </div>
    </div>
  );
}



