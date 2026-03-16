'use client';

import { useEffect, useState } from 'react';
import { generateHTML } from '@tiptap/html';

import { TemplateApi } from '@/services/template';
import { StaticExtensionKit } from '@/extensions/extension-kit';

const DocsPage = () => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchContent = async () => {
      try {
        const res = await TemplateApi.ProjectorIntro();

        if (!isActive) return;

        if (res.data?.code === 200) {
          const content = res.data.data.content;

          // 将 TipTap JSON 转换为 HTML
          let html: string;
          if (typeof content === 'string') {
            // 如果已经是字符串，直接使用
            html = content;
          } else {
            // 如果是 TipTap JSON，使用 generateHTML 转换
            html = generateHTML(content, StaticExtensionKit);
          }

          setHtmlContent(html);
          setError(null);
        } else {
          setError('内容加载失败');
        }
      } catch (err) {
        if (isActive) {
          setError('内容加载失败');
          console.error(err);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="h-full w-full overflow-auto bg-white dark:bg-slate-900">
      <div className="h-full overflow-y-auto overflow-x-hidden relative w-full">
        <div className="prose-container h-full pl-14 pr-14 py-8">
          {isLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">加载中...</div>
          ) : error ? (
            <div className="text-sm text-rose-500">{error}</div>
          ) : htmlContent ? (
            <div
              className="ProseMirror prose prose-sm prose-gray dark:prose-invert max-w-none focus:outline-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">暂无内容</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
