'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  CheckSquare,
  X,
  FolderPlus,
  FilePlus,
  Move,
  Copy,
  PanelLeftClose,
  RefreshCw,
  Star,
} from 'lucide-react';

import Folder from './folder';
import StarredView from './StarredView';
import SharedDocumentsView from './SharedDocumentsView';
import MoveDialog from './folder/components/MoveDialog';

import { documentsApi } from '@/services/documents';
import { useSidebar } from '@/stores/sidebarStore';
import { cn, getCurrentUserId } from '@/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { toastSuccess, toastError } from '@/utils/toast';
import {
  collectAllFileItemIds,
  collectSelectedFileIds,
  countAllNodesInGroups,
} from '@/utils/sidebar-tree-count';
import { useFileStore } from '@/stores/fileStore';

type NavItem = 'home' | 'trash';

export default function SidebarContent() {
  const router = useRouter();
  const { activeTab, setActiveTab, toggle } = useSidebar();
  const starredBatchMode = useSidebar((s) => s.starredBatchMode);
  const starredSelectedIds = useSidebar((s) => s.starredSelectedIds);
  const clearStarredSelection = useSidebar((s) => s.clearStarredSelection);
  const bumpStarredList = useSidebar((s) => s.bumpStarredList);
  const bumpSharedList = useSidebar((s) => s.bumpSharedList);
  const sharedListVersion = useSidebar((s) => s.sharedListVersion);
  const sharedBatchMode = useSidebar((s) => s.sharedBatchMode);
  const sharedSelectedIds = useSidebar((s) => s.sharedSelectedIds);
  const sharedDocumentIds = useSidebar((s) => s.sharedDocumentIds);
  const clearSharedSelection = useSidebar((s) => s.clearSharedSelection);
  const enterSharedBatchWithAll = useSidebar((s) => s.enterSharedBatchWithAll);
  const setSharedBatchMode = useSidebar((s) => s.setSharedBatchMode);

  const [showStarred, setShowStarred] = useState(true);
  const [showShared, setShowShared] = useState(true);
  const [showLibrary, setShowLibrary] = useState(true);
  const [sharedCount, setSharedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // 批量选择状态
  const {
    batchMode,
    selectedItems,
    setBatchMode,
    clearSelection,
    batchCopy,
    batchMove,
    batchDelete,
    setNewItemFolder,
    setNewItemType,
    setNewItemName,
    setNewItemGroupId,
    documentGroups,
    loadFiles,
    selectAll,
    setBatchSelectedItems,
    patchDocumentStarred,
  } = useFileStore();

  const libraryNodeCount = useMemo(() => countAllNodesInGroups(documentGroups), [documentGroups]);

  const libraryAllIds = useMemo(() => collectAllFileItemIds(documentGroups), [documentGroups]);

  const librarySelectAllCheckbox = useMemo(() => {
    if (libraryAllIds.length === 0) {
      return { checked: false as boolean | 'indeterminate', disabled: true };
    }
    const n = selectedItems.filter((id) => libraryAllIds.includes(String(id))).length;
    if (n === 0) return { checked: false as const, disabled: false };
    if (n === libraryAllIds.length) return { checked: true as const, disabled: false };
    return { checked: 'indeterminate' as const, disabled: false };
  }, [libraryAllIds, selectedItems]);

  const toggleLibrarySelectAll = () => {
    if (libraryAllIds.length === 0) return;
    const n = selectedItems.filter((id) => libraryAllIds.includes(String(id))).length;
    if (n === libraryAllIds.length) {
      setBatchSelectedItems([]);
    } else {
      selectAll();
    }
  };

  // 主导航项 - 只保留主页
  const mainNavItems = [{ id: 'home' as NavItem, label: '主页', icon: Home }];

  const handleNavClick = (navId: NavItem) => {
    setActiveTab(navId);
    if (navId === 'home') {
      router.push('/docs');
    }
    if (navId === 'trash') {
      router.push('/docs/recycle');
    }
  };

  // 开始创建新项目
  const startCreateNewItem = (type: 'file' | 'folder') => {
    const personalGroup = documentGroups.find((g) => g.type === 'personal');
    if (personalGroup) {
      setNewItemFolder('root');
      setNewItemType(type);
      setNewItemName('');
      setNewItemGroupId(personalGroup.id);
    }
    setShowCreateMenu(false);
    setShowLibrary(true);
  };

  // 处理批量复制
  const handleBatchCopy = async () => {
    if (selectedItems.length === 0) return;
    await batchCopy();
  };

  // 处理批量移动
  const handleBatchMove = async (targetFolderId: string | null) => {
    if (selectedItems.length === 0) return;
    await batchMove(targetFolderId);
    setShowMoveDialog(false);
  };

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) return;
    if (confirm(`确定要删除选中的 ${selectedItems.length} 个文件吗？`)) {
      await batchDelete();
    }
  };

  const toggleLibraryBatchMode = () => {
    if (!batchMode) {
      clearStarredSelection();
      clearSharedSelection();
    }
    setBatchMode(!batchMode);
  };

  const toggleSharedBatchMode = () => {
    if (!sharedBatchMode) {
      clearSelection();
      clearStarredSelection();
      enterSharedBatchWithAll(sharedDocumentIds);
    } else {
      setSharedBatchMode(false);
    }
  };

  const handleSharedBatchStar = async () => {
    const uid = getCurrentUserId();
    if (!uid || sharedSelectedIds.length === 0) return;
    const { error } = await documentsApi.batchStarDocuments(uid, sharedSelectedIds);
    if (error) {
      toastError('收藏失败');
      return;
    }
    toastSuccess('已加入收藏');
    for (const id of sharedSelectedIds) {
      patchDocumentStarred(id, true);
    }
    bumpStarredList();
  };

  const handleSharedBatchUnstar = async () => {
    const uid = getCurrentUserId();
    if (!uid || sharedSelectedIds.length === 0) return;
    if (!confirm(`确定取消收藏选中的 ${sharedSelectedIds.length} 个文档？`)) return;
    for (const id of sharedSelectedIds) {
      await documentsApi.star(id, { isStarred: false, userId: uid });
      patchDocumentStarred(id, false);
    }
    toastSuccess('已取消收藏');
    clearSharedSelection();
    bumpStarredList();
  };

  const handleBatchStarLibrary = async () => {
    const uid = getCurrentUserId();
    if (!uid || selectedItems.length === 0) return;
    const fileIds = collectSelectedFileIds(documentGroups, selectedItems);
    if (fileIds.length === 0) {
      toastError('请选择文档文件（无法收藏文件夹）');
      return;
    }
    const { error } = await documentsApi.batchStarDocuments(uid, fileIds);
    if (error) {
      toastError('收藏失败');
      return;
    }
    toastSuccess('已加入收藏');
    bumpStarredList();
  };

  const handleStarredBatchUnstar = async () => {
    const uid = getCurrentUserId();
    if (!uid || starredSelectedIds.length === 0) return;
    if (!confirm(`确定取消收藏选中的 ${starredSelectedIds.length} 个文档？`)) return;
    for (const id of starredSelectedIds) {
      await documentsApi.star(id, { isStarred: false, userId: uid });
      patchDocumentStarred(id, false);
    }
    toastSuccess('已取消收藏');
    clearStarredSelection();
    bumpStarredList();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a1a]">
      {/* 顶部 Logo 区域 */}
      <div className="flex items-center h-14 px-3 border-gray-100 dark:border-gray-800">
        {/* 关闭侧边栏按钮 - 放在左侧 */}
        <button
          type="button"
          onClick={toggle}
          className="p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          aria-label="隐藏侧边栏"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
        {/* Logo 和品牌名 - 更简洁的表现形式 */}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <FileText className="w-3 h-3 text-white" />
          </div>
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">文档</span>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="搜索文档"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full h-9 pl-9 pr-3 text-sm rounded-lg',
              'bg-gray-100 dark:bg-gray-800',
              'border border-transparent',
              'focus:bg-white dark:focus:bg-gray-900',
              'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
              'placeholder:text-gray-400',
              'transition-all duration-200',
              'outline-none',
            )}
          />
        </div>
      </div>

      {/* 主导航：与上方搜索、下方分区标题统一使用 px-3 水平边距，避免「主页」与整列错位 */}
      <div className="px-3 pb-2">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={cn(
                'flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-normal transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-blue-500' : 'text-gray-500')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 分割线 */}
      <div className="mx-3 h-px bg-gray-100 dark:bg-gray-800" />

      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {/* 收藏的文档（标题行与「我的文档库」一致：py-1.5 + 右侧工具栏） */}
        <div className="py-1">
          <StarredView
            isActive={true}
            compact
            sectionExpanded={showStarred}
            onToggleSection={() => setShowStarred(!showStarred)}
          />
        </div>

        {/* 分享的文档 */}
        <div className="py-1">
          <div className="flex items-center justify-between gap-1 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setShowShared(!showShared)}
              className="flex min-w-0 flex-1 items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <span className="truncate">共享的文档 ({sharedCount})</span>
              {showShared ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
            {showShared && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    bumpSharedList();
                  }}
                  className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  title="刷新列表"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSharedBatchMode();
                  }}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    sharedBatchMode
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600',
                  )}
                  title={sharedBatchMode ? '退出批量操作' : '批量操作'}
                >
                  {sharedBatchMode ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {showShared && (
            <div className="px-1">
              <SharedDocumentsView
                isActive={true}
                compact
                listVersion={sharedListVersion}
                onCountChange={setSharedCount}
              />
            </div>
          )}
        </div>

        {/* 我的文档库（略收紧标题与列表间距） */}
        <div className="py-1">
          <div className="flex items-center justify-between gap-1 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className="flex min-w-0 flex-1 items-center text-xs font-medium text-gray-500 uppercase tracking-wider transition-colors hover:text-gray-700 dark:hover:text-gray-300"
            >
              <span className="truncate">我的文档库 ({libraryNodeCount})</span>
              {showLibrary ? (
                <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0" />
              )}
            </button>
            {showLibrary && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void loadFiles(false);
                  }}
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  title="刷新列表"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                {/* 批量操作按钮 */}
                <button
                  type="button"
                  onClick={toggleLibraryBatchMode}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    batchMode
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600',
                  )}
                  title={batchMode ? '退出批量操作' : '批量操作'}
                >
                  {batchMode ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    <CheckSquare className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* 新建菜单 */}
                <div className="relative" ref={createMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowCreateMenu(!showCreateMenu)}
                    className="rounded p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
                    title="新建"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* 新建菜单下拉 */}
                  {showCreateMenu && (
                    <>
                      {/* 遮罩层 */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowCreateMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
                        <button
                          type="button"
                          className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          onClick={() => startCreateNewItem('file')}
                        >
                          <FilePlus className="mr-2 h-4 w-4 text-blue-500" />
                          新建文档
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          onClick={() => startCreateNewItem('folder')}
                        >
                          <FolderPlus className="mr-2 h-4 w-4 text-amber-500" />
                          新建文件夹
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {batchMode && showLibrary && (
            <div className="mb-1 flex items-center gap-2 px-3 py-1">
              <Checkbox
                checked={
                  librarySelectAllCheckbox.checked === 'indeterminate'
                    ? 'indeterminate'
                    : librarySelectAllCheckbox.checked
                }
                disabled={librarySelectAllCheckbox.disabled}
                onCheckedChange={() => toggleLibrarySelectAll()}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">全选</span>
            </div>
          )}

          {showLibrary && (
            <div className="px-1">
              <Folder compact />
            </div>
          )}
        </div>
      </div>

      {/* 底部：收藏批量栏 / 文档库批量栏 / 回收站 */}
      {starredBatchMode ? (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              已选择 {starredSelectedIds.length} 项
            </span>
            <button
              type="button"
              onClick={clearStarredSelection}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
              onClick={() => void handleStarredBatchUnstar()}
              disabled={starredSelectedIds.length === 0}
            >
              <Star className="w-3 h-3 text-red-500" />
              取消收藏
            </button>
          </div>
        </div>
      ) : sharedBatchMode ? (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-violet-50 dark:bg-violet-950/25">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              已选择 {sharedSelectedIds.length} 项
            </span>
            <button
              type="button"
              onClick={clearSharedSelection}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 basis-[45%] items-center justify-center gap-1 rounded bg-white px-2 py-1.5 text-xs transition-colors hover:bg-violet-100 dark:bg-gray-800 dark:hover:bg-violet-900/30 sm:flex-1 sm:basis-auto"
              onClick={() => void handleSharedBatchStar()}
              disabled={sharedSelectedIds.length === 0}
            >
              <Star className="h-3 w-3 shrink-0 text-amber-500" />
              收藏
            </button>
            <button
              type="button"
              className="flex min-w-0 flex-1 basis-[45%] items-center justify-center gap-1 rounded bg-red-50 px-2 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/35 sm:flex-1 sm:basis-auto"
              onClick={() => void handleSharedBatchUnstar()}
              disabled={sharedSelectedIds.length === 0}
            >
              <Star className="h-3 w-3 shrink-0 text-red-500" />
              取消收藏
            </button>
          </div>
        </div>
      ) : batchMode ? (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              已选择 {selectedItems.length} 项
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 basis-[45%] items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors sm:flex-1 sm:basis-auto"
              onClick={() => setShowMoveDialog(true)}
            >
              <Move className="w-3 h-3 shrink-0" />
              移动
            </button>
            <button
              type="button"
              className="flex min-w-0 flex-1 basis-[45%] items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors sm:flex-1 sm:basis-auto"
              onClick={handleBatchCopy}
            >
              <Copy className="w-3 h-3 shrink-0" />
              复制
            </button>
            <button
              type="button"
              className="flex min-w-0 flex-1 basis-[45%] items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors sm:flex-1 sm:basis-auto"
              onClick={() => void handleBatchStarLibrary()}
            >
              <Star className="w-3 h-3 shrink-0 text-amber-500" />
              收藏
            </button>
            <button
              type="button"
              className="flex min-w-0 flex-1 basis-[45%] items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors sm:flex-1 sm:basis-auto"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-3 h-3 shrink-0" />
              删除
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => handleNavClick('trash')}
            className={cn(
              'flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
              activeTab === 'trash' && 'bg-red-50 dark:bg-red-900/20',
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>回收站</span>
          </button>
        </div>
      )}

      {/* 移动对话框 */}
      <MoveDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
        onConfirm={handleBatchMove}
      />
    </div>
  );
}
