'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Star,
  CheckSquare,
  X,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import StarredAddDocumentsDialog from './StarredAddDocumentsDialog';

import { Checkbox } from '@/components/ui/checkbox';
import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import type { FileItem } from '@/types/file-system';
import { toastSuccess } from '@/utils/toast';
import { cn, getCurrentUserId } from '@/utils';
import { SIDEBAR_LIST_ROW_HOVER, SIDEBAR_LIST_ROW_SELECTED } from '@/utils/sidebar-list-styles';
import { useFileStore } from '@/stores/fileStore';
import { useSidebar } from '@/stores/sidebarStore';

interface StarredViewProps {
  isActive: boolean;
  compact?: boolean;
  sectionExpanded?: boolean;
  onToggleSection?: () => void;
}

export default function StarredView({
  isActive,
  compact,
  sectionExpanded = true,
  onToggleSection,
}: StarredViewProps) {
  const router = useRouter();
  const documentGroups = useFileStore((s) => s.documentGroups);
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const patchDocumentStarred = useFileStore((s) => s.patchDocumentStarred);
  const bumpStarredList = useSidebar((s) => s.bumpStarredList);
  const starredListVersion = useSidebar((s) => s.starredListVersion);
  const starredBatchMode = useSidebar((s) => s.starredBatchMode);
  const starredSelectedIds = useSidebar((s) => s.starredSelectedIds);
  const setStarredBatchMode = useSidebar((s) => s.setStarredBatchMode);
  const enterStarredBatchWithAll = useSidebar((s) => s.enterStarredBatchWithAll);
  const setStarredSelectedIds = useSidebar((s) => s.setStarredSelectedIds);
  const toggleStarredSelection = useSidebar((s) => s.toggleStarredSelection);
  const filterStarredSelection = useSidebar((s) => s.filterStarredSelection);
  const clearStarredSelection = useSidebar((s) => s.clearStarredSelection);
  const clearSharedSelection = useSidebar((s) => s.clearSharedSelection);
  const setStarredDocumentIds = useSidebar((s) => s.setStarredDocumentIds);

  const [starredDocs, setStarredDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const libraryFiles = useMemo<FileItem[]>(() => {
    const personal = documentGroups.find((g) => g.type === 'personal');
    return personal?.files ?? [];
  }, [documentGroups]);

  useEffect(() => {
    setStarredDocumentIds(starredDocs.map((d) => d.documentId));
  }, [starredDocs, setStarredDocumentIds]);

  const loadStarredDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const ownerId = getCurrentUserId();
      if (!ownerId) {
        setStarredDocs([]);
        return;
      }
      const result = await documentsApi.getStarred({ userId: ownerId });
      const payload = result.data?.data;
      if (payload) {
        const list = Array.isArray(payload)
          ? payload
          : ((payload as { documents?: Document[] }).documents ?? []);
        setStarredDocs(list);
      } else {
        setStarredDocs([]);
      }
    } catch (error) {
      console.error('加载收藏文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void loadStarredDocs();
  }, [isActive, starredListVersion, sectionExpanded, loadStarredDocs]);

  useEffect(() => {
    const valid = new Set(starredDocs.map((d) => d.documentId));
    filterStarredSelection(valid);
  }, [starredDocs, filterStarredSelection]);

  const starredIdSet = useMemo(() => new Set(starredDocs.map((d) => d.documentId)), [starredDocs]);

  const allIds = useMemo(() => starredDocs.map((d) => d.documentId), [starredDocs]);

  const headerCheckboxState = useMemo(() => {
    if (allIds.length === 0) return { checked: false as boolean | 'indeterminate', disabled: true };
    const n = allIds.filter((id) => starredSelectedIds.includes(id)).length;
    if (n === 0) return { checked: false as const, disabled: false };
    if (n === allIds.length) return { checked: true as const, disabled: false };
    return { checked: 'indeterminate' as const, disabled: false };
  }, [allIds, starredSelectedIds]);

  const toggleHeaderCheckbox = () => {
    if (allIds.length === 0) return;
    const n = allIds.filter((id) => starredSelectedIds.includes(id)).length;
    if (n === allIds.length) {
      if (!confirm(`确定取消收藏全部 ${allIds.length} 个文档？`)) return;
      void (async () => {
        const uid = getCurrentUserId();
        if (!uid) return;
        for (const id of allIds) {
          await documentsApi.star(id, { isStarred: false, userId: uid });
          patchDocumentStarred(id, false);
        }
        toastSuccess('已取消收藏');
        clearStarredSelection();
        await loadStarredDocs();
        bumpStarredList();
      })();
    } else {
      setStarredSelectedIds([...allIds]);
    }
  };

  const handleRowCheckbox = (docId: string, next: boolean) => {
    if (next) {
      toggleStarredSelection(docId);
      return;
    }
    void (async () => {
      const uid = getCurrentUserId();
      if (!uid) return;
      await documentsApi.star(docId, { isStarred: false, userId: uid });
      patchDocumentStarred(docId, false);
      toastSuccess('已取消收藏');
      toggleStarredSelection(docId);
      await loadStarredDocs();
      bumpStarredList();
    })();
  };

  const handleUnstar = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    try {
      const uid = getCurrentUserId();
      if (!uid) return;
      await documentsApi.star(docId, { isStarred: false, userId: uid });
      patchDocumentStarred(docId, false);
      await loadStarredDocs();
      bumpStarredList();
    } catch (error) {
      console.error('取消收藏失败:', error);
    }
  };

  const handleClick = (docId: string) => {
    if (starredBatchMode) {
      const isOn = starredSelectedIds.includes(docId);
      handleRowCheckbox(docId, !isOn);
      return;
    }
    router.push(`/docs/${docId}`);
  };

  const toggleStarredBatch = () => {
    useFileStore.getState().clearSelection();
    clearSharedSelection();
    if (starredBatchMode) {
      setStarredBatchMode(false);
    } else {
      enterStarredBatchWithAll(starredDocs.map((d) => d.documentId));
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: zhCN });
    } catch {
      return '';
    }
  };

  const showHeader = Boolean(onToggleSection);

  const listContent = (() => {
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
              <p className="text-xs mt-1 opacity-60">点击右上角「+」添加收藏</p>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {starredDocs.map((doc) => {
          const rowChecked = starredBatchMode && starredSelectedIds.includes(doc.documentId);
          const isOpenInStarredSection =
            !starredBatchMode && String(selectedFileId) === doc.documentId;
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
                'group flex items-center rounded-lg cursor-pointer transition-colors',
                compact ? 'px-3 py-2' : 'px-2 py-2',
                starredBatchMode ? 'cursor-default' : '',
                !rowChecked && !isOpenInStarredSection && SIDEBAR_LIST_ROW_HOVER,
                rowChecked && SIDEBAR_LIST_ROW_SELECTED,
                isOpenInStarredSection && SIDEBAR_LIST_ROW_SELECTED,
              )}
            >
              {starredBatchMode && (
                <span
                  className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={rowChecked}
                    onCheckedChange={(c) => handleRowCheckbox(doc.documentId, c === true)}
                  />
                </span>
              )}
              <div className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'truncate font-normal text-gray-700 dark:text-gray-200',
                    compact ? 'text-[13px]' : 'text-sm',
                  )}
                >
                  {doc.title}
                </div>
                {!compact && (
                  <div className="text-xs text-gray-400">{formatTime(doc.updatedAt)}</div>
                )}
              </div>
              {!starredBatchMode && (
                <button
                  type="button"
                  onClick={(e) => handleUnstar(e, doc.documentId)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  title="取消收藏"
                >
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <div className={compact ? '' : 'p-2'}>
      {showHeader && (
        <div className="flex items-center justify-between gap-1 px-3 py-1.5">
          <button
            type="button"
            onClick={onToggleSection}
            className="flex min-w-0 flex-1 items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <span className="truncate">收藏的文档 ({starredDocs.length})</span>
            {sectionExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>
          {sectionExpanded && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void loadStarredDocs();
                }}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                title="刷新列表"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleStarredBatch}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  starredBatchMode
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600',
                )}
                title={starredBatchMode ? '退出批量' : '批量'}
              >
                {starredBatchMode ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <CheckSquare className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                title="添加收藏"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {!showHeader && !compact && (
        <div className="text-xs font-medium text-gray-400 px-2 py-2 uppercase tracking-wider">
          收藏的文档 ({starredDocs.length})
        </div>
      )}

      {starredBatchMode && starredDocs.length > 0 && (
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
          <span className="text-xs text-gray-500">全选</span>
        </div>
      )}

      {(!showHeader || sectionExpanded) && (
        <div className={cn(showHeader && 'px-1')}>{listContent}</div>
      )}

      <StarredAddDocumentsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        starredIds={starredIdSet}
        libraryFiles={libraryFiles}
        onSuccess={() => bumpStarredList()}
      />
    </div>
  );
}
