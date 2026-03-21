'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, FileText, Folder, Loader2 } from 'lucide-react';

import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import { cn } from '@/utils';

interface SharedDocumentsViewProps {
  isActive: boolean;
  compact?: boolean;
}

interface SharedDocumentItem {
  id: string;
  title: string;
  type: 'FILE' | 'FOLDER';
  ownerName: string;
  permission: string;
}

export default function SharedDocumentsView({ isActive, compact }: SharedDocumentsViewProps) {
  const router = useRouter();
  const [sharedDocs, setSharedDocs] = useState<SharedDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isActive) {
      loadSharedDocs();
    }
  }, [isActive]);

  const loadSharedDocs = async () => {
    setIsLoading(true);
    try {
      // 获取与我共享的文档
      const result = await documentsApi.getSharedWithMe({ userId: '' });
      // 修复类型问题 - 使用双重 data 嵌套
      const responseData = (result.data as unknown as { data?: { documents: Document[] } })?.data;
      if (responseData?.documents) {
        const items: SharedDocumentItem[] = responseData.documents.map((doc: Document) => ({
          id: doc.documentId,
          title: doc.title,
          type: doc.type,
          ownerName: doc.owner?.name || '未知用户',
          permission: 'view',
        }));
        setSharedDocs(items);
      }
    } catch (error) {
      console.error('加载分享文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = (docId: string) => {
    router.push(`/docs/${docId}`);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', compact ? 'h-20' : 'h-40')}>
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (sharedDocs.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-gray-400',
          compact ? 'h-16 py-2' : 'h-40',
        )}
      >
        {compact ? (
          <p className="text-xs">暂无分享</p>
        ) : (
          <>
            <Share2 className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">暂无分享的文档</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'p-2'}>
      <div className="space-y-0.5">
        {sharedDocs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => handleClick(doc.id)}
            className={cn(
              'group flex items-center gap-2 rounded-lg cursor-pointer transition-colors',
              compact ? 'px-2 py-1.5' : 'px-2 py-2',
              'hover:bg-purple-50 dark:hover:bg-purple-900/20',
            )}
          >
            {doc.type === 'FOLDER' ? (
              <Folder
                className={cn('text-amber-500 flex-shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}
              />
            ) : (
              <FileText
                className={cn('text-purple-500 flex-shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}
              />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  'font-medium text-gray-700 dark:text-gray-200 truncate',
                  compact ? 'text-xs' : 'text-sm',
                )}
              >
                {doc.title}
              </div>
              {!compact && <div className="text-xs text-gray-400">来自: {doc.ownerName}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
