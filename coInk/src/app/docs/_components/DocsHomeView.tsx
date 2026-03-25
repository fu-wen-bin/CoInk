'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  FilePlus,
  FileText,
  Folder,
  Loader2,
  LogOut,
  MoreHorizontal,
  PanelLeft,
  Settings,
  Share2,
  Star,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

import { useSidebar } from '@/stores/sidebarStore';
import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';
import { cn, getCurrentUserId } from '@/utils';
import { toastSuccess, toastError, toastLoading, toastInfo } from '@/utils/toast';
import { useFileStore } from '@/stores/fileStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogoutMutation, useUserQuery } from '@/hooks/useUserQuery';
import ShareDialog from '@/app/docs/_components/DocumentSidebar/folder/ShareDialog';
import type { FileItem } from '@/types/file-system';

type HomeTab = 'recent' | 'owned' | 'shared' | 'starred';

function unwrapDocuments(payload: unknown): Document[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Document[];
  if (typeof payload === 'object' && 'documents' in payload) {
    return (payload as { documents?: Document[] }).documents ?? [];
  }
  return [];
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm');
  } catch {
    return '—';
  }
}

function getLocationLabel(doc: Document, tab: HomeTab): string {
  if (doc.parentFolderTitle) return doc.parentFolderTitle;
  if (tab === 'shared') return '与我共享';
  return '我的文档库';
}

/** 文档列表行：圆角；无选中且未悬停时透明底，仅悬停/选中着色 */
function rowCellClasses(isSelected: boolean): string {
  return cn(
    'align-middle transition-colors first:rounded-l-md last:rounded-r-md',
    isSelected
      ? 'bg-[#EBF2FF] group-hover/row:bg-[#E4EDFC] dark:bg-blue-950/35 dark:group-hover/row:bg-blue-950/45'
      : 'bg-transparent group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/40',
  );
}

function getOwnerLabel(
  doc: Document,
  tab: HomeTab,
  currentUserId: string | null,
  currentUserName: string | undefined,
): string {
  if (tab === 'shared') {
    return doc.owner?.name ?? '—';
  }
  if (doc.owner?.name) {
    return doc.owner.name;
  }
  if (currentUserId && doc.ownerId === currentUserId) {
    return currentUserName?.trim() || '—';
  }
  return currentUserName?.trim() || '—';
}

function docToFileItem(doc: Document): FileItem {
  return {
    id: doc.documentId,
    name: doc.title,
    type: 'file',
    parentId: doc.parentId ?? null,
    depth: 0,
    is_starred: doc.isStarred,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

export default function DocsHomeView() {
  const router = useRouter();
  const [tab, setTab] = useState<HomeTab>('recent');
  const [rows, setRows] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<Document | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const documentGroups = useFileStore((s) => s.documentGroups);
  const setNewItemFolder = useFileStore((s) => s.setNewItemFolder);
  const setNewItemType = useFileStore((s) => s.setNewItemType);
  const setNewItemName = useFileStore((s) => s.setNewItemName);
  const setNewItemGroupId = useFileStore((s) => s.setNewItemGroupId);
  const { isOpen: isSidebarOpen, toggle: toggleSidebar, setActiveTab: setSidebarNav, bumpStarredList } = useSidebar();
  const pathname = usePathname();
  const { data: user } = useUserQuery();
  const logoutMutation = useLogoutMutation();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname === '/docs') {
      setSidebarNav('home');
    }
  }, [pathname, setSidebarNav]);

  const startCreateFile = useCallback(() => {
    const personalGroup = documentGroups.find((g) => g.type === 'personal');
    if (personalGroup) {
      setNewItemFolder('root');
      setNewItemType('file');
      setNewItemName('');
      setNewItemGroupId(personalGroup.id);
    }
  }, [documentGroups, setNewItemFolder, setNewItemGroupId, setNewItemName, setNewItemType]);

  const startCreateFolder = useCallback(() => {
    const personalGroup = documentGroups.find((g) => g.type === 'personal');
    if (personalGroup) {
      setNewItemFolder('root');
      setNewItemType('folder');
      setNewItemName('');
      setNewItemGroupId(personalGroup.id);
    }
  }, [documentGroups, setNewItemFolder, setNewItemGroupId, setNewItemName, setNewItemType]);

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
      if (tab === 'shared') {
        const res = await documentsApi.getSharedWithMe({ userId });
        if (res.error) {
          setError(res.error);
          setRows([]);
          return;
        }
        const docs = unwrapDocuments(res.data?.data).filter((d) => d.type === 'FILE');
        setRows([...docs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
        return;
      }

      if (tab === 'starred') {
        const res = await documentsApi.getStarred({ userId });
        if (res.error) {
          setError(res.error);
          setRows([]);
          return;
        }
        const docs = unwrapDocuments(res.data?.data).filter((d) => d.type === 'FILE');
        setRows([...docs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
        return;
      }

      const res = await documentsApi.getMyDocuments(userId);
      if (res.error) {
        setError(res.error);
        setRows([]);
        return;
      }
      const files = unwrapDocuments(res.data?.data).filter((d) => d.type === 'FILE');
      if (tab === 'recent') {
        setRows(
          [...files].sort((a, b) => {
            const ta = new Date(a.lastAccessedAt || a.updatedAt).getTime();
            const tb = new Date(b.lastAccessedAt || b.updatedAt).getTime();
            return tb - ta;
          }),
        );
      } else {
        setRows([...files].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = new Set<string>();
      for (const id of prev) {
        if (rows.some((r) => r.documentId === id)) ids.add(id);
      }
      return ids;
    });
  }, [rows]);

  const handleSoftDelete = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`将「${doc.title}」移入回收站？`)) return;
    const toastId = toastLoading('正在删除...');
    const userId = getCurrentUserId();
    // 如果被收藏，先取消收藏
    if (doc.isStarred && userId) {
      await documentsApi.star(doc.documentId, { isStarred: false, userId });
    }
    const { error } = await documentsApi.softDelete(doc.documentId);
    if (error) {
      toastError(error, { id: toastId });
      return;
    }
    toastSuccess('已移入回收站', { id: toastId });
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

  const canBulkTrash = tab !== 'shared';

  const singleSelectedDoc =
    selectedIds.size === 1 ? rows.find((r) => r.documentId === [...selectedIds][0]) : undefined;

  const handleRemoveFromRecent = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`将选中的 ${ids.length} 个文档从「最近访问」记录中移除？`)) return;
    const { error } = await documentsApi.removeFromRecent({ userId, documentIds: ids });
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess('已从最近列表移除');
    clearSelection();
    void loadRows();
  };

  const handleToolbarShare = () => {
    if (!singleSelectedDoc) return;
    setShareTarget(singleSelectedDoc);
  };

  const handleToolbarStar = async () => {
    if (!singleSelectedDoc) return;
    const uid = getCurrentUserId();
    if (!uid) {
      toastError('请先登录');
      return;
    }
    const { error } = await documentsApi.star(singleSelectedDoc.documentId, {
      isStarred: !singleSelectedDoc.isStarred,
      userId: uid,
    });
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess(singleSelectedDoc.isStarred ? '已取消收藏' : '已收藏');
    bumpStarredList();
    clearSelection();
    void loadRows();
  };

  const handleToolbarDelete = async () => {
    if (!singleSelectedDoc) return;
    if (!window.confirm(`将「${singleSelectedDoc.title}」移入回收站？`)) return;
    const toastId = toastLoading('正在删除...');
    const userId = getCurrentUserId();
    // 如果被收藏，先取消收藏
    if (singleSelectedDoc.isStarred && userId) {
      await documentsApi.star(singleSelectedDoc.documentId, { isStarred: false, userId });
    }
    const { error } = await documentsApi.softDelete(singleSelectedDoc.documentId);
    if (error) {
      toastError(error, { id: toastId });
      return;
    }
    toastSuccess('已移入回收站', { id: toastId });
    clearSelection();
    void loadRows();
  };

  const handleToggleStar = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    const uid = getCurrentUserId();
    if (!uid) {
      toastError('请先登录');
      return;
    }
    const { error } = await documentsApi.star(doc.documentId, {
      isStarred: !doc.isStarred,
      userId: uid,
    });
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess(doc.isStarred ? '已取消收藏' : '已收藏');
    bumpStarredList();
    void loadRows();
  };

  const tabs: { id: HomeTab; label: string }[] = [
    { id: 'recent', label: '最近访问' },
    { id: 'owned', label: '归我所有' },
    { id: 'shared', label: '与我共享' },
    { id: 'starred', label: '收藏' },
  ];

  const displayUser = user;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="显示侧边栏"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            文档
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            控制台
          </Link>
          {mounted && displayUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-md px-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="账户菜单"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={displayUser.avatarUrl || ''} alt={displayUser.name || ''} />
                    <AvatarFallback className="text-xs">
                      {displayUser.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-md">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{displayUser.name}</p>
                    <p className="text-xs text-muted-foreground">{displayUser.email || '—'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/user" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    个人资料
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    账户设置
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-rose-600 focus:text-rose-600"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800" />
          )}
        </div>
      </header>

      <section className="relative z-30 shrink-0 px-6 py-4">
        <div className="grid grid-cols-4 gap-3">
          {/* 1. 新建（Radix 在 SSR 与客户端会生成不同 id，需挂载后再渲染 DropdownMenu 避免水合报错） */}
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-[160px] flex-1 items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white">
                    <FilePlus className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      新建
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      新建文档开始协作
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-56 rounded-md p-1 shadow-xl"
              >
                <DropdownMenuItem
                  className="cursor-pointer rounded-md"
                  onClick={() => startCreateFile()}
                >
                  <FileText className="mr-2 h-4 w-4 text-blue-500" />
                  文档
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-md"
                  onClick={() => startCreateFolder()}
                >
                  <Folder className="mr-2 h-4 w-4 text-amber-500" />
                  文件夹
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              disabled
              className="flex min-w-[160px] flex-1 cursor-default items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-left opacity-90 dark:border-slate-700"
              aria-hidden
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white">
                <FilePlus className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">新建</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">新建文档开始协作</div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}

          {/* 2. 上传 */}
          <button
            type="button"
            title="即将支持"
            className="flex min-w-[160px] flex-1 items-center gap-3 rounded-md border border-dashed border-slate-200 px-4 py-3 text-left opacity-90 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
            onClick={() => toastInfo('上传本地文件功能即将上线')}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white">
              <Upload className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">上传</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                上传本地文件（即将支持）
              </div>
            </div>
          </button>
        </div>
      </section>

      <div className="relative z-0 shrink-0 pl-3 pr-6 sm:pl-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'whitespace-nowrap px-4 py-3 text-lg font-medium transition-colors',
                tab === t.id
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

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
              <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                暂无文档
              </p>
            ) : (
              <div className="rounded-md">
                <table className="w-full min-w-[780px] border-separate border-spacing-x-0 border-spacing-y-0 text-left text-sm">
                  <thead>
                    <tr className="group/header relative">
                      <th
                        className={cn(
                          'w-10 shrink-0 align-middle py-3 pl-2.5 pr-1.5 transition-opacity',
                          allSelected || someSelected
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/header:opacity-100 focus-within:opacity-100',
                        )}
                      >
                        <div className="flex min-h-5 items-center justify-start">
                          <Checkbox
                            checked={headerCheckboxState}
                            onCheckedChange={(v) => toggleSelectAll(v === true)}
                            aria-label="全选当前列表"
                          />
                        </div>
                      </th>
                      <th className="align-middle py-3 pl-0 pr-4 text-sm font-medium leading-none text-slate-600 dark:text-slate-300">
                        标题
                      </th>
                      <th className="hidden align-middle py-3 pl-0 pr-4 text-sm font-medium leading-none text-slate-600 sm:table-cell dark:text-slate-300">
                        位置
                      </th>
                      <th className="hidden align-middle py-3 pl-0 pr-4 text-sm font-medium leading-none text-slate-600 md:table-cell dark:text-slate-300">
                        所有者
                      </th>
                      <th className="hidden align-middle py-3 pl-0 pr-4 text-sm font-medium leading-none text-slate-600 lg:table-cell dark:text-slate-300">
                        创建时间
                      </th>
                      <th className="align-middle py-3 pl-0 pr-4 text-sm font-medium leading-none text-slate-600 dark:text-slate-300">
                        最近访问
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
                            'group/row relative cursor-pointer',
                            !isLastRow &&
                              "after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:z-0 after:h-px after:rounded-none after:content-['']",
                            !isLastRow &&
                              (isSelected
                                ? 'after:bg-white dark:after:bg-white'
                                : 'after:bg-slate-100 dark:after:bg-slate-800/40'),
                          )}
                          onClick={() => router.push(`/docs/${doc.documentId}`)}
                        >
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'w-10 shrink-0 align-middle py-3 pl-2.5 pr-1.5 transition-opacity',
                              isSelected
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100',
                            )}
                            onClick={(e) => e.stopPropagation()}
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
                              <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {doc.title}
                              </span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'hidden py-3 pl-0 pr-4 text-slate-600 dark:text-slate-400 sm:table-cell',
                            )}
                          >
                            {getLocationLabel(doc, tab)}
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'hidden py-3 pl-0 pr-4 text-slate-600 dark:text-slate-400 md:table-cell',
                            )}
                          >
                            {getOwnerLabel(doc, tab, getCurrentUserId(), user?.name)}
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'hidden py-3 pl-0 pr-4 text-slate-600 dark:text-slate-400 lg:table-cell',
                            )}
                          >
                            {formatDateTime(doc.createdAt)}
                          </td>
                          <td
                            className={cn(
                              rowCellClasses(isSelected),
                              'py-3 pl-0 pr-4 text-sm text-slate-600 dark:text-slate-400',
                            )}
                          >
                            {formatDateTime(doc.lastAccessedAt)}
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
                                    className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="更多操作"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  sideOffset={6}
                                  className="w-44 rounded-md p-1 shadow-xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => handleToggleStar(doc, e)}
                                  >
                                    <Star className="mr-2 h-4 w-4 text-amber-500" />
                                    {doc.isStarred ? '取消收藏' : '收藏'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShareTarget(doc);
                                    }}
                                  >
                                    <Share2 className="mr-2 h-4 w-4" />
                                    分享
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer text-rose-600 focus:text-rose-600"
                                    onClick={(e) => handleSoftDelete(doc, e)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除
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
                                onClick={(e) => e.stopPropagation()}
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

              {selectedIds.size === 1 && singleSelectedDoc ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 border-blue-200 bg-white text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-950/50"
                    onClick={handleToolbarShare}
                  >
                    <Share2 className="mr-1.5 h-4 w-4" />
                    分享
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 border-amber-200 bg-white text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-amber-950/40"
                    onClick={() => void handleToolbarStar()}
                  >
                    <Star className="mr-1.5 h-4 w-4 text-amber-500" />
                    {singleSelectedDoc.isStarred ? '取消收藏' : '收藏'}
                  </Button>
                  {canBulkTrash ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => void handleToolbarDelete()}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      删除
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={() => void handleRemoveFromRecent()}
                >
                  从「最近列表」中移除
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {shareTarget ? (
        <ShareDialog
          file={docToFileItem(shareTarget)}
          isOpen
          variant="modal"
          onClose={() => setShareTarget(null)}
        />
      ) : null}
    </div>
  );
}
