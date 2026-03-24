'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Search } from 'lucide-react';
import { toastSuccess, toastError } from '@/utils/toast';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import type { FileItem } from '@/types/file-system';
import { cn, getCurrentUserId } from '@/utils';

function flattenFiles(items: FileItem[]): FileItem[] {
  const out: FileItem[] = [];
  for (const item of items) {
    if (item.type === 'file') out.push(item);
    if (item.children?.length) out.push(...flattenFiles(item.children));
  }
  return out;
}

function unwrapDocuments(payload: unknown): Document[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Document[];
  if (typeof payload === 'object' && payload !== null && 'documents' in payload) {
    return (payload as { documents?: Document[] }).documents ?? [];
  }
  return [];
}

export interface StarredAddDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 已收藏的 documentId，用于禁用或提示 */
  starredIds: Set<string>;
  /** 侧边栏「我的文档库」树 */
  libraryFiles: FileItem[];
  onSuccess: () => void;
}

export default function StarredAddDocumentsDialog({
  open,
  onOpenChange,
  starredIds,
  libraryFiles,
  onSuccess,
}: StarredAddDocumentsDialogProps) {
  const [search, setSearch] = useState('');
  const [sharedDocs, setSharedDocs] = useState<Document[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const ownedFiles = useMemo(() => flattenFiles(libraryFiles), [libraryFiles]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(new Set());
      return;
    }
    const uid = getCurrentUserId();
    if (!uid) return;
    setLoadingShared(true);
    void documentsApi
      .getSharedWithMe({ userId: uid })
      .then(({ data, error }) => {
        if (error) {
          setSharedDocs([]);
          return;
        }
        setSharedDocs(unwrapDocuments(data?.data));
      })
      .finally(() => setLoadingShared(false));
  }, [open]);

  const ownedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ownedFiles.filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [ownedFiles, search]);

  const sharedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sharedDocs.filter((d) => !q || d.title.toLowerCase().includes(q));
  }, [sharedDocs, search]);

  const toggleId = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const uid = getCurrentUserId();
    if (!uid) {
      toastError('请先登录');
      return;
    }
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toastError('请选择要收藏的文档');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await documentsApi.batchStarDocuments(uid, ids);
      if (error) {
        toastError('批量收藏失败');
        return;
      }
      toastSuccess('已添加到收藏');
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toastError('批量收藏失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRow = (id: string, title: string, subtitle?: string) => {
    const already = starredIds.has(id);
    const checked = already ? true : selected.has(id);
    const disabled = already;
    return (
      <div
        key={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => toggleId(id, disabled)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleId(id, disabled);
          }
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20',
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => toggleId(id, disabled)}
          />
        </span>
        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">
            {title}
            {already ? '（已收藏）' : ''}
          </span>
          {subtitle ? (
            <span className="block truncate text-xs text-gray-400">{subtitle}</span>
          ) : null}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <DialogTitle>添加收藏</DialogTitle>
          <div className="relative pt-2">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文档…"
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </DialogHeader>

        <div className="max-h-[min(52vh,480px)] overflow-y-auto px-2 py-2">
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            我的文档库
          </p>
          <div className="space-y-0.5">
            {ownedRows.map((f) => renderRow(f.id, f.name))}
            {ownedRows.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-gray-400">无匹配文档</p>
            )}
          </div>

          <p className="mt-3 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            与我共享
          </p>
          {loadingShared ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {sharedRows.map((d) =>
                renderRow(
                  d.documentId,
                  d.title,
                  d.owner?.name ? `来自 ${d.owner.name}` : undefined,
                ),
              )}
              {sharedRows.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-gray-400">无匹配文档</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? '提交中…' : '确定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
