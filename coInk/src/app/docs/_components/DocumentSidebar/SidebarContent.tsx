'use client';

import { useState, useRef } from 'react';
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
} from 'lucide-react';

import Folder from './folder';
import StarredView from './StarredView';
import SharedDocumentsView from './SharedDocumentsView';
import MoveDialog from './folder/components/MoveDialog';

import { useSidebar } from '@/stores/sidebarStore';
import { cn } from '@/utils';
import { useFileStore } from '@/stores/fileStore';

type NavItem = 'home' | 'trash';

export default function SidebarContent() {
  const router = useRouter();
  const { activeTab, setActiveTab, toggle } = useSidebar();
  const [showStarred, setShowStarred] = useState(true);
  const [showShared, setShowShared] = useState(true);
  const [showLibrary, setShowLibrary] = useState(true);
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
  } = useFileStore();

  // 主导航项 - 只保留主页
  const mainNavItems = [{ id: 'home' as NavItem, label: '主页', icon: Home }];

  const handleNavClick = (navId: NavItem) => {
    setActiveTab(navId);
    if (navId === 'home') {
      router.push('/docs');
    }
    if (navId === 'trash') {
      router.push('/docs/trash');
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a1a]">
      {/* 顶部 Logo 区域 */}
      <div className="flex items-center h-14 px-4 border-gray-100 dark:border-gray-800">
        {/* 关闭侧边栏按钮 - 放在左侧 */}
        <button
          type="button"
          onClick={toggle}
          className="p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
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

      {/* 主导航 */}
      <div className="px-2 pb-2">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-normal transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
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
        {/* 收藏的文档 */}
        <div className="py-1">
          <button
            onClick={() => setShowStarred(!showStarred)}
            className="w-full flex items-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span>收藏的文档</span>
            {showStarred ? (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            )}
          </button>

          {showStarred && (
            <div className="px-1">
              <StarredView isActive={true} compact />
            </div>
          )}
        </div>

        {/* 分享的文档 */}
        <div className="py-1">
          <button
            onClick={() => setShowShared(!showShared)}
            className="w-full flex items-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span>分享的文档</span>
            {showShared ? (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            )}
          </button>

          {showShared && (
            <div className="px-1">
              <SharedDocumentsView isActive={true} compact />
            </div>
          )}
        </div>

        {/* 我的文档库 */}
        <div className="py-1">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <span>我的文档库</span>
              {showLibrary ? (
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              )}
            </button>
            <div className="flex items-center gap-0.5">
              {/* 批量操作按钮 */}
              <button
                onClick={() => setBatchMode(!batchMode)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  batchMode
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600',
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
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                  title="新建"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {/* 新建菜单下拉 */}
                {showCreateMenu && (
                  <>
                    {/* 遮罩层 */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
                      <button
                        className="w-full text-left px-3 py-2 text-sm flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => startCreateNewItem('file')}
                      >
                        <FilePlus className="w-4 h-4 mr-2 text-blue-500" />
                        新建文档
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => startCreateNewItem('folder')}
                      >
                        <FolderPlus className="w-4 h-4 mr-2 text-amber-500" />
                        新建文件夹
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {showLibrary && (
            <div className="px-1">
              <Folder compact />
            </div>
          )}
        </div>
      </div>

      {/* 底部 - 批量操作栏或回收站 */}
      {batchMode ? (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              已选择 {selectedItems.length} 项
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setShowMoveDialog(true)}
            >
              <Move className="w-3 h-3" />
              移动
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={handleBatchCopy}
            >
              <Copy className="w-3 h-3" />
              复制
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-3 h-3" />
              删除
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => handleNavClick('trash')}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
              activeTab === 'trash'
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
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
