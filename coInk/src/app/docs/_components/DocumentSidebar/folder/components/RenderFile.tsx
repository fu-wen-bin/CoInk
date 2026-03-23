'use client';

import React, { Ref, useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Folder, Check, X, ChevronDown, ChevronRight } from 'lucide-react';

import FileItemMenu from '../FileItemMenu';
import { useFileActions } from '../hooks/useFileActions';

import { Checkbox } from '@/components/ui/checkbox';
import type { FileItem } from '@/types/file-system';
import { useFileStore } from '@/stores/fileStore';
import { cn } from '@/utils';
import type { SidebarHighlightZone } from '@/utils/sidebar-highlight-zone';
import { SIDEBAR_LIST_ROW_HOVER, SIDEBAR_LIST_ROW_SELECTED } from '@/utils/sidebar-list-styles';
import { countAllNodesInTree } from '@/utils/sidebar-tree-count';

interface RenderFileProps {
  file: FileItem;
  isOverlay?: boolean;
  depth?: number;
  inputRef?: Ref<HTMLInputElement>;
  id: string;
  groupId?: string;
  onFileSelect: (file: FileItem, e: React.MouseEvent) => void;
  onToggleFolder: (folderId: string, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, fileId: string) => void;
  closeContextMenu: () => void;
  onFinishRenaming: (newName: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onRename: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onDuplicate: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onStar?: (file: FileItem) => void;
  /** 当前打开文档在侧栏的主分区；仅当为 library 时本行显示文档库浅蓝高亮 */
  sidebarHighlightZone?: SidebarHighlightZone;
}

export const RenderFile: React.FC<RenderFileProps> = ({
  file,
  inputRef,
  depth = 0,
  id,
  groupId,
  isOverlay,
  onFileSelect,
  onToggleFolder,
  onContextMenu,
  closeContextMenu,
  onFinishRenaming,
  onKeyDown,
  onRename,
  onShare,
  onDelete,
  onDuplicate,
  onDownload,
  onStar,
  sidebarHighlightZone = null,
}): React.ReactElement => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Use store state directly
  const {
    expandedFolders,
    selectedFileId,
    isRenaming,
    newItemFolder,
    newItemGroupId,
    newItemType,
    newItemName,
    setNewItemName,
    // 批量选择
    batchMode,
    selectedItems,
    toggleItemSelection,
  } = useFileStore();

  // Use file actions hook
  const { finishCreateNewItem, cancelCreateNewItem } = useFileActions();

  const isFolder = file.type === 'folder';
  const isExpanded = isFolder && expandedFolders[file.id];
  // 确保类型一致（字符串 vs 数字）
  const isSelected = String(selectedFileId) === String(file.id);
  const isItemRenaming = String(isRenaming) === String(file.id);
  const isAddingNewItem = String(newItemFolder) === String(file.id) && newItemGroupId === groupId;
  const isBatchSelected = selectedItems.some((item) => String(item) === String(file.id));

  const isOpenDoc = isSelected;
  /** 仅当当前打开文档属于「我的文档库」分区时本行浅蓝高亮 */
  const rowHighlightOpenDoc = !batchMode && isOpenDoc && sidebarHighlightZone === 'library';
  /** 仅打开三点菜单但未打开该文件时用灰底 */
  const rowHighlightMenuOnly = !batchMode && moreMenuOpen && !isOpenDoc;

  const FileItemHeight = 46;

  // 计算有多少个子文件 渲染侧边连接线高度
  const folderLineHeight = (() => {
    if (typeof expandedFolders[file.id] != 'undefined' && expandedFolders[file.id]) {
      return file.children!.length * FileItemHeight;
    }
  })();

  const folderSubtreeCount =
    isFolder && file.children?.length ? countAllNodesInTree(file.children) : 0;

  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: id,
    data: {
      id: id,
      isFolder,
      isExpanded,
    },
  });

  const style = {
    transform: isExpanded ? '' : CSS.Transform.toString(transform),
    transition,
  };

  // 当进入重命名状态时自动聚焦
  useEffect(() => {
    if (isItemRenaming && inputRef && typeof inputRef === 'object' && 'current' in inputRef) {
      inputRef.current?.focus();
      // 选中所有文本，方便用户直接输入
      inputRef.current?.select();
    }
  }, [isItemRenaming, inputRef]);

  // 处理点击事件
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (batchMode) {
      // 批量模式下点击切换选中状态
      toggleItemSelection(file.id);
    } else {
      // 普通模式下正常处理
      if (isFolder) {
        onToggleFolder(file.id, e);
      } else {
        onFileSelect(file, e);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Wrapper styles - left padding based on depth
        'relative',
        // Drag indicator styles
        isDragging && [
          'opacity-100 relative z-[1] -mb-px',
          // TreeItem drag styles
          '[&>div>div]:relative [&>div>div]:p-0 [&>div>div]:h-[5px]',
          '[&>div>div]:border-[oklch(0.81_0.1_252)] [&>div>div]:bg-[oklch(0.79_0.1_275)]',
          '[&>div>div]:before:absolute [&>div>div]:before:left-[-8px] [&>div>div]:before:top-[-4px]',
          '[&>div>div]:before:block [&>div>div]:before:content-[""] [&>div>div]:before:w-3 [&>div>div]:before:h-3',
          '[&>div>div>*]:opacity-0 [&>div>div>*]:h-0',
        ],
      )}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      <div style={style} {...listeners}>
        <div
          className={cn(
            'flex items-center py-2 px-3 text-[13px] font-normal cursor-pointer relative group box-border',
            'transition-all duration-200 ease-out rounded-lg my-0.5 border-2',
            // 批量：选中行
            batchMode && isBatchSelected && [SIDEBAR_LIST_ROW_SELECTED, 'border-transparent'],
            // 批量：未选中行（显式透明底，避免取消勾选后背景残留）
            batchMode &&
              !isBatchSelected && [
                'bg-transparent',
                SIDEBAR_LIST_ROW_HOVER,
                'border-transparent',
                'text-gray-700 dark:text-gray-300',
                sidebarHighlightZone === 'library' &&
                  isOpenDoc &&
                  'ring-1 ring-inset ring-blue-300/70 dark:ring-blue-500/45',
              ],
            // 非批量：当前在编辑器打开的文档 → 浅蓝底
            rowHighlightOpenDoc && [SIDEBAR_LIST_ROW_SELECTED, 'border-transparent'],
            // 非批量：仅打开更多菜单、且未打开该文件 → 灰底（非浅蓝）
            rowHighlightMenuOnly && ['border-transparent', 'bg-gray-100 dark:bg-gray-800'],
            // 非批量：普通行（悬浮灰）
            !batchMode &&
              !rowHighlightOpenDoc &&
              !rowHighlightMenuOnly && [
                SIDEBAR_LIST_ROW_HOVER,
                'border-transparent',
                'text-gray-700 dark:text-gray-300',
              ],
            isOverlay && 'border-lime-500',
          )}
          style={{
            animationDelay: `${depth * 50}ms`,
          }}
          onClick={handleClick}
          onContextMenu={(e) => onContextMenu(e, file.id)}
        >
          {/* 批量选择复选框（与收藏区同一 Checkbox 组件） */}
          {batchMode && (
            <span
              className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={!!isBatchSelected}
                onCheckedChange={() => toggleItemSelection(file.id)}
              />
            </span>
          )}

          {/* 展开/折叠图标 - 只为文件夹显示 */}
          {isFolder && (
            <div className="mr-2 w-5 h-5 flex-shrink-0 flex items-center justify-center">
              <button
                className={cn(
                  'w-5 h-5 rounded flex items-center justify-center transition-colors',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  isSelected || isBatchSelected
                    ? 'text-blue-600'
                    : 'text-gray-400 hover:text-gray-600',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(file.id, e);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* 文件/文件夹图标 */}
          <div className="w-5 h-5 mr-2 flex-shrink-0 flex items-center justify-center">
            {isFolder ? (
              <Folder className={cn('w-4 h-4', isExpanded ? 'text-amber-500' : 'text-amber-400')} />
            ) : (
              <FileText className="w-4 h-4 text-blue-500" />
            )}
          </div>

          {/* 名称/重命名输入框 */}
          <div className="flex min-w-0 flex-1 items-center gap-1 mr-2">
            <input
              ref={inputRef}
              type="text"
              readOnly={!isItemRenaming}
              className={cn(
                'w-full text-[13px] rounded transition-all font-normal',
                'outline-none border',
                isItemRenaming
                  ? [
                      // 编辑状态
                      'bg-white dark:bg-gray-700',
                      'border-blue-400',
                      'focus:border-blue-500',
                      'px-2 py-1',
                      'text-gray-900 dark:text-gray-100',
                      'cursor-text',
                    ]
                  : [
                      // 只读状态（与「收藏的文档」列表字号一致）
                      'bg-transparent border-transparent',
                      'px-0 py-0',
                      'cursor-pointer pointer-events-none',
                      'truncate',
                      batchMode && isBatchSelected && 'text-blue-700 dark:text-blue-300',
                      batchMode && !isBatchSelected && 'text-gray-700 dark:text-gray-300',
                      !batchMode && isOpenDoc && 'text-gray-900 dark:text-gray-100',
                      !batchMode && !isOpenDoc && 'text-gray-700 dark:text-gray-300',
                    ],
              )}
              defaultValue={file.name}
              onBlur={(e) => {
                if (!isItemRenaming) return;

                const newValue = e.target.value.trim();

                // 只有值改变且不为空时才触发更新
                if (newValue && newValue !== file.name) {
                  onFinishRenaming(newValue);
                } else if (!newValue) {
                  // 如果为空，恢复原值
                  e.target.value = file.name;
                }
              }}
              onKeyDown={onKeyDown}
            />
            {isFolder && !isItemRenaming && folderSubtreeCount > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                ({folderSubtreeCount})
              </span>
            )}
          </div>

          {/* 操作按钮区域 */}
          {!batchMode && (
            <div
              className={cn(
                'flex items-center space-x-1',
                'transition-opacity duration-200',
                moreMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              {/* 更多操作菜单 */}
              <FileItemMenu
                file={file}
                onShare={onShare}
                onStar={onStar}
                onDelete={onDelete}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDownload={onDownload}
                onMenuOpen={closeContextMenu}
                onOpenChange={setMoreMenuOpen}
              />
            </div>
          )}
        </div>

        {/* 如果是展开的文件夹，则递归渲染其子项 */}
        {isFolder && isExpanded && (
          <div className="relative">
            {/* 连接线 */}
            <div
              className={cn('absolute left-4 w-px', 'bg-gray-200 dark:bg-gray-700')}
              style={{ marginLeft: `${depth * 16}px`, height: `${folderLineHeight}px` }}
            ></div>
            <div className="relative">
              {/* 新建项目输入框 */}
              {isAddingNewItem && (
                <div
                  className={cn(
                    'flex items-center py-2 px-3 text-sm mx-2 my-0.5',
                    'bg-green-50 dark:bg-green-900/20',
                    'border border-green-200 dark:border-green-700 rounded-lg',
                  )}
                  style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
                >
                  <div className="w-5 h-5 mr-2 flex-shrink-0">
                    {newItemType === 'folder' ? (
                      <Folder className="w-4 h-4 text-green-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 flex items-center space-x-2">
                    <input
                      ref={inputRef}
                      type="text"
                      className={cn(
                        'flex-1 bg-white dark:bg-gray-700',
                        'border border-green-400',
                        'focus:border-green-500 focus:ring-1 focus:ring-green-500',
                        'px-2 py-1 text-sm rounded',
                        'text-gray-900 dark:text-gray-100',
                      )}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={onKeyDown}
                      autoFocus
                      placeholder={`${newItemType === 'folder' ? '文件夹' : '文件'}名称`}
                    />
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        className="p-1.5 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                        onClick={() => finishCreateNewItem()}
                        title="确认"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        onClick={cancelCreateNewItem}
                        title="取消"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 递归渲染子文件/子文件夹 */}
              {file.children?.map((child) => (
                <RenderFile
                  key={child.id}
                  file={child}
                  id={child.id}
                  depth={depth + 1}
                  groupId={groupId}
                  inputRef={inputRef}
                  isOverlay={isOverlay}
                  onFileSelect={onFileSelect}
                  onToggleFolder={onToggleFolder}
                  onContextMenu={onContextMenu}
                  closeContextMenu={closeContextMenu}
                  onFinishRenaming={onFinishRenaming}
                  onKeyDown={onKeyDown}
                  onRename={onRename}
                  onShare={onShare}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onDownload={onDownload}
                  onStar={onStar}
                  sidebarHighlightZone={sidebarHighlightZone}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
