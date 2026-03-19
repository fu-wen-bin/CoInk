'use client';

import React, { Ref, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Folder, Check, MoreVertical, X, ChevronDown, ChevronRight } from 'lucide-react';

import FileItemMenu from '../FileItemMenu';
import { useFileActions } from '../hooks/useFileActions';

import type { FileItem } from '@/types/file-system';
import { useFileStore } from '@/stores/fileStore';
import { cn } from '@/utils';

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
}): React.ReactElement => {
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
  const { startCreateNewItem, finishCreateNewItem, cancelCreateNewItem } = useFileActions();

  const isFolder = file.type === 'folder';
  const isExpanded = isFolder && expandedFolders[file.id];
  // 确保类型一致（字符串 vs 数字）
  const isSelected = String(selectedFileId) === String(file.id);
  const isItemRenaming = String(isRenaming) === String(file.id);
  const isAddingNewItem = String(newItemFolder) === String(file.id) && newItemGroupId === groupId;
  const isBatchSelected = selectedItems.some((item) => String(item) === String(file.id));

  const FileItemHeight = 46;

  // 计算有多少个子文件 渲染侧边连接线高度
  const folderLineHeight = (() => {
    if (typeof expandedFolders[file.id] != 'undefined' && expandedFolders[file.id]) {
      return file.children!.length * FileItemHeight;
    }
  })();

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
            'transition-all duration-200 ease-out rounded-md my-0.5',
            // 批量选中状态
            isBatchSelected && [
              'bg-blue-100 dark:bg-blue-900/30',
              'border-2 border-blue-500 dark:border-blue-400',
            ],
            // 普通选中状态
            !isBatchSelected &&
              isSelected && [
                'bg-blue-50 dark:bg-blue-900/20',
                'text-blue-700 dark:text-blue-300',
                'border-2 border-blue-500 dark:border-blue-400',
              ],
            // 未选中状态
            !isBatchSelected &&
              !isSelected && [
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'text-gray-700 dark:text-gray-300',
                'border-2 border-transparent',
              ],
            isOverlay && 'border-lime-500 border-2',
          )}
          style={{
            animationDelay: `${depth * 50}ms`,
          }}
          onClick={handleClick}
          onContextMenu={(e) => onContextMenu(e, file.id)}
        >
          {/* 批量选择复选框 */}
          {batchMode && (
            <div className="mr-2 flex-shrink-0">
              <div
                className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                  isBatchSelected
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
                )}
              >
                {isBatchSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
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
          <div className="flex-1 min-w-0 mr-2">
            <input
              ref={inputRef}
              type="text"
              readOnly={!isItemRenaming}
              className={cn(
                'w-full text-sm rounded transition-all font-medium',
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
                      // 只读状态
                      'bg-transparent border-transparent',
                      'px-0 py-0',
                      'cursor-pointer pointer-events-none',
                      'truncate',
                      isSelected || isBatchSelected
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300',
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
          </div>

          {/* 操作按钮区域 */}
          {!batchMode && (
            <div
              className={cn(
                'flex items-center space-x-1',
                'opacity-0 group-hover:opacity-100',
                'transition-opacity duration-200',
              )}
            >
              {/* 更多操作菜单 */}
              <FileItemMenu
                file={file}
                onShare={onShare}
                onDelete={onDelete}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDownload={onDownload}
                onMenuOpen={closeContextMenu}
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
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
