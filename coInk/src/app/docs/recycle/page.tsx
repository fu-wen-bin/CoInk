'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  FileText,
  Folder,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

import { toastSuccess, toastError } from '@/utils/toast';
import { useFileStore } from '@/stores/fileStore';
import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import { cn, getCurrentUserId } from '@/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm');
  } catch {
    return '—';
  }
}

/** 文档列表行：圆角；无选中且未悬停时透明底，仅悬停/选中着色 */
function rowCellClasses(isSelected: boolean): string {
  return cn(
    'align-middle transition-colors first:rounded-l-md last:rounded-r-md',
    isSelected
      ? 'bg-[#EBF2FF] group-hover/row:bg-[#E4EDFC] dark:bg-blue-950/35 dark:group-hover/row:bg-blue-950/45'
      : 'bg-transparent group-hover/row:bg-slate-100 dark:group-hover/row:bg-slate-800/60',
  );
}

export default function RecycleBinPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // 对话框状态
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [targetDoc, setTargetDoc] = useState<Document | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadRows = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setRows([]);
      setError('请先登录');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await documentsApi.getDeleted({ ownerId: userId });
      if (res.error) {
        setError(res.error);
        setRows([]);
        return;
      }
      const docs = res.data?.data?.documents ?? [];
      setRows([...docs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const handleRestore = async (doc: Document) => {
    setTargetDoc(doc);
    setRestoreDialogOpen(true);
  };

  const confirmRestore = async () => {
    if (!targetDoc) return;
    const { error } = await documentsApi.restore(targetDoc.documentId);
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess('文档已恢复');
    setRestoreDialogOpen(false);
    setTargetDoc(null);
    void loadRows();
    // 只刷新文档库（收藏列表在后台自动同步）
    void useFileStore.getState().loadFiles(false);
  };

  const handlePermanentDelete = async (doc: Document) => {
    setTargetDoc(doc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!targetDoc) return;
    const { error } = await documentsApi.permanentDelete(targetDoc.documentId);
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess('文档已彻底删除');
    setDeleteDialogOpen(false);
    setTargetDoc(null);
    void loadRows();
  };

  const toggleRowSelected = (documentId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(documentId);
      else next.delete(documentId);
      return next;
    });
  };

  const allSelectableIds = rows.map((r) => r.documentId);
  const allSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.has(id));
  const someSelected = allSelectableIds.some((id) => selectedIds.has(id)) && !allSelected;
  const headerCheckboxState: boolean | 'indeterminate' = allSelected
    ? true
    : someSelected
      ? 'indeterminate'
      : false;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(allSelectableIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const singleSelectedDoc =
    selectedIds.size === 1 ? rows.find((r) => r.documentId === [...selectedIds][0]) : undefined;

  const handleBulkRestore = () => {
    if (selectedIds.size === 0) return;
    setBulkRestoreDialogOpen(true);
  };

  const confirmBulkRestore = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const { error } = await documentsApi.restore(id);
      if (error) {
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toastSuccess(`成功恢复 ${successCount} 个文档`);
    }
    if (failCount > 0) {
      toastError(`${failCount} 个文档恢复失败`);
    }

    setBulkRestoreDialogOpen(false);
    clearSelection();
    void loadRows();
    // 只刷新文档库（收藏列表在后台自动同步）
    void useFileStore.getState().loadFiles(false);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const { error } = await documentsApi.permanentDelete(id);
      if (error) {
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toastSuccess(`成功删除 ${successCount} 个文档`);
    }
    if (failCount > 0) {
      toastError(`${failCount} 个文档删除失败`);
    }

    setBulkDeleteDialogOpen(false);
    clearSelection();
    void loadRows();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              回收站
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/docs"
            className="rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            返回主页
          </Link>
        </div>
      </header>

      {/* 内容区域 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto py-4 pl-3 pr-6 sm:pl-4">
          <div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <p className="py-12 text-center text-sm text-rose-500">{error}</p>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Trash2 className="mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" />
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  回收站是空的
                </p>
                <p className="mt-1 text-center text-xs text-slate-400 dark:text-slate-500">
                  删除的文档会在这里显示
                </p>
              </div>
            ) : (
              <div className="rounded-md">
                <table className="w-full min-w-[780px] border-separate border-spacing-x-0 border-spacing-y-0 text-left text-sm">
                  <thead>
                    <tr className="group/header relative">
                      <th
                        className={cn(
                          'w-10 shrink-0 py-3 pl-2.5 pr-1.5 align-middle transition-opacity',
                          allSelected || someSelected
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/header:opacity-100 focus-within:opacity-100',
                        )}
                      >
                        <div className="flex min-h-5 items-center justify-start">
                          <Checkbox
                            checked={
                              headerCheckboxState === 'indeterminate'
                                ? 'indeterminate'
                                : headerCheckboxState
                            }
                            onCheckedChange={(v) => toggleSelectAll(v === true)}
                            aria-label="全选当前列表"
                          />
                        </div>
                      </th>
                      <th className="py-3 pl-0 pr-4 align-middle text-sm font-medium leading-none text-slate-600 dark:text-slate-300">
                        标题
                      </th>
                      <th className="hidden py-3 pl-0 pr-4 align-middle text-sm font-medium leading-none text-slate-600 md:table-cell dark:text-slate-300">
                        类型
                      </th>
                      <th className="hidden py-3 pl-0 pr-4 align-middle text-sm font-medium leading-none text-slate-600 lg:table-cell dark:text-slate-300">
                        删除时间
                      </th>
                      <th className="py-3 pl-0 pr-4 align-middle text-sm font-medium leading-none text-slate-600 dark:text-slate-300">
                        原位置
                      </th>
                      <th className="w-12 py-3 pl-0 pr-0 align-middle" aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((doc, index) => {
                      const isSelected = selectedIds.has(doc.documentId);
                      const isLastRow = index === rows.length - 1;
                      return (
                        <tr
                          key={doc.documentId}
                          className={cn(
                            'group/row relative',
                            !isLastRow &&
                              "after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:z-0 after:h-px after:rounded-none after:content-['']",
                            !isLastRow &&
                              (isSelected
                                ? 'after:bg-white dark:after:bg-white'
                                : 'after:bg-slate-100 dark:after:bg-slate-800/40'),
                          )}
                        >
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'w-10 shrink-0 py-3 pl-2.5 pr-1.5 transition-opacity',
                              isSelected
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100',
                            )}
                          >
                            <div className="flex min-h-5 items-center justify-start">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(v) =>
                                  toggleRowSelected(doc.documentId, v === true)
                                }
                                aria-label={`选择 ${doc.title}`}
                              />
                            </div>
                          </td>
                          <td className={cn(rowCellClasses(isSelected), 'py-3 pl-0 pr-4')}>
                            <div className="flex items-center gap-1.5">
                              {doc.type === 'FOLDER' ? (
                                <Folder className="h-5 w-5 shrink-0 text-amber-500" />
                              ) : (
                                <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                              )}
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {doc.title}
                              </span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'hidden py-3 pl-0 pr-4 text-slate-600 dark:text-slate-400 md:table-cell',
                            )}
                          >
                            {doc.type === 'FOLDER' ? '文件夹' : '文档'}
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'hidden py-3 pl-0 pr-4 text-slate-600 dark:text-slate-400 lg:table-cell',
                            )}
                          >
                            {formatDateTime(doc.updatedAt)}
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'py-3 pl-0 pr-4 text-sm text-slate-600 dark:text-slate-400',
                            )}
                          >
                            {doc.parentFolderTitle || '我的文档库'}
                          </td>
                          <td
                            className={cn(rowCellClasses(isSelected), 'py-3 pl-0 pr-2 text-right')}
                          >
                            {mounted ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    aria-label="更多操作"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  sideOffset={6}
                                  className="w-44 rounded-md p-1 shadow-xl"
                                >
                                  <DropdownMenuItem
                                    className="cursor-pointer text-blue-600 focus:text-blue-600"
                                    onClick={() => handleRestore(doc)}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    恢复
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer text-rose-600 focus:text-rose-600"
                                    onClick={() => handlePermanentDelete(doc)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    彻底删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-default rounded-md text-slate-500"
                                disabled
                                aria-hidden
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 底部工具栏 */}
        {selectedIds.size > 0 ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                已选 {selectedIds.size} 项
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-slate-600"
                onClick={clearSelection}
              >
                清空
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-blue-200 bg-white text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-950/50"
                onClick={() => void handleBulkRestore()}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                恢复
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={() => void handleBulkDelete()}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                彻底删除
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 恢复确认对话框 */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复文档</AlertDialogTitle>
            <AlertDialogDescription>
              确定要恢复「{targetDoc?.title}」吗？恢复后文档将回到原来的位置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetDoc(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmRestore()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 彻底删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">彻底删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要彻底删除「{targetDoc?.title}
              」吗？此操作不可恢复，文档及其所有历史记录将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetDoc(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-rose-600 hover:bg-rose-700"
            >
              彻底删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量恢复确认对话框 */}
      <AlertDialog open={bulkRestoreDialogOpen} onOpenChange={setBulkRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量恢复文档</AlertDialogTitle>
            <AlertDialogDescription>
              确定要恢复选中的 {selectedIds.size} 个文档吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmBulkRestore()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量彻底删除确认对话框 */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">批量彻底删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要彻底删除选中的 {selectedIds.size} 个文档吗？此操作不可恢复！
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmBulkDelete()}
              className="bg-rose-600 hover:bg-rose-700"
            >
              彻底删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
