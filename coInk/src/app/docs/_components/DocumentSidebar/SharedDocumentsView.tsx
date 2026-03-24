'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, FileText, Folder, Loader2 } from 'lucide-react';
import { toastSuccess, toastError, toastInfo } from '@/utils/toast';

import FileItemMenu from './folder/FileItemMenu';

import { Checkbox } from '@/components/ui/checkbox';
import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import type { FileItem } from '@/types/file-system';
import { useFileStore } from '@/stores/fileStore';
import { useSidebar } from '@/stores/sidebarStore';
import { cn, getCurrentUserId } from '@/utils';
import { getSidebarHighlightZone } from '@/utils/sidebar-highlight-zone';
import {
  SIDEBAR_LIST_ROW_HOVER_SHARED,
  SIDEBAR_LIST_ROW_SELECTED_SHARED,
} from '@/utils/sidebar-list-styles';

interface SharedDocumentsViewProps {
  isActive: boolean;
  compact?: boolean;
  listVersion?: number;
  onCountChange?: (count: number) => void;
}

function documentToFileItem(doc: Document): FileItem {
  return {
    id: doc.documentId,
    name: doc.title,
    type: doc.type === 'FOLDER' ? 'folder' : 'file',
    depth: 0,
    is_starred: doc.isStarred,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

export default function SharedDocumentsView({
  isActive,
  compact,
  listVersion = 0,
  onCountChange,
}: SharedDocumentsViewProps) {
  const router = useRouter();
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const patchDocumentStarred = useFileStore((s) => s.patchDocumentStarred);
  const { documentGroups } = useFileStore();

  const bumpStarredList = useSidebar((s) => s.bumpStarredList);
  const sharedBatchMode = useSidebar((s) => s.sharedBatchMode);
  const sharedSelectedIds = useSidebar((s) => s.sharedSelectedIds);
  const setSharedSelectedIds = useSidebar((s) => s.setSharedSelectedIds);
  const toggleSharedSelection = useSidebar((s) => s.toggleSharedSelection);
  const filterSharedSelection = useSidebar((s) => s.filterSharedSelection);
  const setSharedDocumentIds = useSidebar((s) => s.setSharedDocumentIds);
  const sharedDocumentIds = useSidebar((s) => s.sharedDocumentIds);
  const starredDocumentIds = useSidebar((s) => s.starredDocumentIds);

  const [sharedDocs, setSharedDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const libraryFiles = useMemo(
    () => documentGroups.find((g) => g.type === 'personal')?.files ?? [],
    [documentGroups],
  );

  const sidebarHighlightZone = useMemo(
    () =>
      getSidebarHighlightZone(
        selectedFileId,
        libraryFiles,
        sharedDocumentIds,
        starredDocumentIds,
      ),
    [selectedFileId, libraryFiles, sharedDocumentIds, starredDocumentIds],
  );

  const loadSharedDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setSharedDocs([]);
        onCountChange?.(0);
        return;
      }
      const result = await documentsApi.getSharedWithMe({ userId });
      const payload = result.data?.data;
      const docList: Document[] = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && 'documents' in payload
          ? (payload as { documents: Document[] }).documents
          : [];
      setSharedDocs(docList);
      onCountChange?.(docList.length);
    } catch (error) {
      console.error('加载共享文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    if (!isActive) return;
    void loadSharedDocs();
  }, [isActive, listVersion, loadSharedDocs]);

  useEffect(() => {
    setSharedDocumentIds(sharedDocs.map((d) => d.documentId));
  }, [sharedDocs, setSharedDocumentIds]);

  useEffect(() => {
    const valid = new Set(sharedDocs.map((d) => d.documentId));
    filterSharedSelection(valid);
  }, [sharedDocs, filterSharedSelection]);

  const allIds = useMemo(() => sharedDocs.map((d) => d.documentId), [sharedDocs]);

  const headerCheckboxState = useMemo(() => {
    if (allIds.length === 0) return { checked: false as boolean | 'indeterminate', disabled: true };
    const n = allIds.filter((id) => sharedSelectedIds.includes(id)).length;
    if (n === 0) return { checked: false as const, disabled: false };
    if (n === allIds.length) return { checked: true as const, disabled: false };
    return { checked: 'indeterminate' as const, disabled: false };
  }, [allIds, sharedSelectedIds]);

  const toggleHeaderCheckbox = () => {
    if (allIds.length === 0) return;
    const n = allIds.filter((id) => sharedSelectedIds.includes(id)).length;
    if (n === allIds.length) {
      setSharedSelectedIds([]);
    } else {
      setSharedSelectedIds([...allIds]);
    }
  };

  const handleStar = async (file: FileItem, doc: Document) => {
    if (doc.sharedAccessDenied) {
      toastError('当前无访问权限，无法收藏');
      return;
    }
    if (file.type !== 'file') return;
    const uid = getCurrentUserId();
    if (!uid) {
      toastError('请先登录');
      return;
    }
    const next = !file.is_starred;
    const { error } = await documentsApi.star(file.id, { isStarred: next, userId: uid });
    if (error) {
      toastError(next ? '收藏失败' : '取消收藏失败');
      return;
    }
    patchDocumentStarred(file.id, next);
    setSharedDocs((prev) =>
      prev.map((d) =>
        d.documentId === file.id ? { ...d, isStarred: next } : d,
      ),
    );
    toastSuccess(next ? '已加入收藏' : '已取消收藏');
    bumpStarredList();
  };

  const handleClick = (docId: string) => {
    if (sharedBatchMode) {
      toggleSharedSelection(docId);
      return;
    }
    router.push(`/docs/${docId}`);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', compact ? 'h-20' : 'h-40')}>
        <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
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
          <p className="text-[13px] font-normal">暂无共享</p>
        ) : (
          <>
            <Share2 className="mb-2 h-12 w-12 opacity-30" />
            <p className="text-sm font-normal">暂无共享的文档</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'p-2'}>
      {sharedBatchMode && sharedDocs.length > 0 && (
        <div className="mb-1 flex items-center gap-2 px-3 py-1">
          <Checkbox
            checked={
              headerCheckboxState.checked === 'indeterminate'
                ? 'indeterminate'
                : headerCheckboxState.checked
            }
            disabled={headerCheckboxState.disabled}
            onCheckedChange={() => toggleHeaderCheckbox()}
          />
          <span className="text-xs text-violet-600 dark:text-violet-300">全选</span>
        </div>
      )}

      <div className="space-y-0.5">
        {sharedDocs.map((doc) => {
          const file = documentToFileItem(doc);
          const rowChecked = sharedBatchMode && sharedSelectedIds.includes(doc.documentId);
          const isOpenInSharedSection =
            !sharedBatchMode &&
            String(selectedFileId) === doc.documentId &&
            sidebarHighlightZone === 'shared';

          return (
            <div
              key={doc.documentId}
              role="button"
              tabIndex={0}
              onClick={() => handleClick(doc.documentId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick(doc.documentId);
                }
              }}
              className={cn(
                'group flex cursor-pointer items-center rounded-lg transition-colors',
                compact ? 'px-3 py-2' : 'px-2 py-2',
                sharedBatchMode ? 'cursor-default' : '',
                !rowChecked && !isOpenInSharedSection && SIDEBAR_LIST_ROW_HOVER_SHARED,
                rowChecked && SIDEBAR_LIST_ROW_SELECTED_SHARED,
                isOpenInSharedSection && SIDEBAR_LIST_ROW_SELECTED_SHARED,
              )}
            >
              {sharedBatchMode && (
                <span
                  className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={rowChecked}
                    onCheckedChange={() => toggleSharedSelection(doc.documentId)}
                    className="border-violet-400 data-[state=checked]:bg-violet-600 data-[state=checked]:text-white"
                  />
                </span>
              )}
              <div className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {doc.type === 'FOLDER' ? (
                  <Folder className="h-4 w-4 text-amber-500" />
                ) : (
                  <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 font-normal text-gray-700 dark:text-gray-200',
                    compact ? 'text-[13px]' : 'text-sm',
                    isOpenInSharedSection && 'text-gray-900 dark:text-gray-100',
                  )}
                >
                  <span className="truncate">{doc.title}</span>
                  {doc.sharedAccessDenied && (
                    <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      无权限
                    </span>
                  )}
                </div>
                {!compact && (
                  <div className="text-xs font-normal text-gray-400">
                    来自: {doc.owner?.name || '未知用户'}
                  </div>
                )}
              </div>
              {!sharedBatchMode && (
                <FileItemMenu
                  file={file}
                  onShare={() => toastInfo('请在文档内使用分享功能')}
                  onDownload={undefined}
                  onDuplicate={undefined}
                  onRename={undefined}
                  onDelete={undefined}
                  onStar={
                    doc.type === 'FILE' ? (f) => void handleStar(f, doc) : undefined
                  }
                  className="opacity-0 group-hover:opacity-100"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
