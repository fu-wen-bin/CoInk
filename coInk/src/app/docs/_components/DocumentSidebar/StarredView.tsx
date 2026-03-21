'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import { cn } from '@/utils';

interface StarredViewProps {
  isActive: boolean;
  compact?: boolean;
}

export default function StarredView({ isActive, compact }: StarredViewProps) {
  const router = useRouter();
  const [starredDocs, setStarredDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isActive) {
      loadStarredDocs();
    }
  }, [isActive]);

  const loadStarredDocs = async () => {
    setIsLoading(true);
    try {
      const result = await documentsApi.getStarred({ page: 1, limit: 50 });
      if (result.data?.data) {
        setStarredDocs(result.data.data);
      }
    } catch (error) {
      console.error('加载收藏文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstar = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    try {
      await documentsApi.star(docId, { isStarred: false });
      // 刷新列表
      loadStarredDocs();
    } catch (error) {
      console.error('取消收藏失败:', error);
    }
  };

  const handleClick = (docId: string) => {
    router.push(`/docs/${docId}`);
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: zhCN });
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', compact ? 'h-20' : 'h-40')}>
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (starredDocs.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-gray-400',
          compact ? 'h-16 py-2' : 'h-40',
        )}
      >
        {compact ? (
          <p className="text-xs">暂无收藏</p>
        ) : (
          <>
            <Star className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">暂无收藏的文档</p>
            <p className="text-xs mt-1 opacity-60">点击文档旁的星标可收藏文档</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'p-2'}>
      {!compact && (
        <div className="text-xs font-medium text-gray-400 px-2 py-2 uppercase tracking-wider">
          收藏的文档 ({starredDocs.length})
        </div>
      )}
      <div className="space-y-0.5">
        {starredDocs.map((doc) => (
          <div
            key={doc.documentId}
            onClick={() => handleClick(doc.documentId)}
            className={cn(
              'group flex items-center gap-2 rounded-lg cursor-pointer transition-colors',
              compact ? 'px-2 py-1.5' : 'px-2 py-2',
              'hover:bg-blue-50 dark:hover:bg-blue-900/20',
            )}
          >
            <FileText
              className={cn('text-blue-500 flex-shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}
            />
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  'font-medium text-gray-700 dark:text-gray-200 truncate',
                  compact ? 'text-xs' : 'text-sm',
                )}
              >
                {doc.title}
              </div>
              {!compact && <div className="text-xs text-gray-400">{formatTime(doc.updatedAt)}</div>}
            </div>
            <button
              onClick={(e) => handleUnstar(e, doc.documentId)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              title="取消收藏"
            >
              <Star
                className={cn('text-yellow-500 fill-yellow-500', compact ? 'w-3 h-3' : 'w-4 h-4')}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
