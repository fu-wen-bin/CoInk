'use client';

import { useState } from 'react';
import { Folder, FileText, X, ChevronRight, ChevronDown } from 'lucide-react';

import { useFileStore } from '@/stores/fileStore';
import type { FileItem } from '@/types/file-system';
import { cn } from '@/utils';

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetFolderId: string | null) => void;
}

export default function MoveDialog({ isOpen, onClose, onConfirm }: MoveDialogProps) {
  const { documentGroups } = useFileStore();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleConfirm = () => {
    onConfirm(selectedFolderId);
    setSelectedFolderId(null);
  };

  const handleClose = () => {
    onClose();
    setSelectedFolderId(null);
  };

  // 递归渲染文件夹树
  const renderFolderTree = (items: FileItem[], depth = 0) => {
    return items
      .filter((item) => item.type === 'folder')
      .map((folder) => {
        const isExpanded = expandedFolders[folder.id];
        const isSelected = selectedFolderId === folder.id;
        const hasChildren = folder.children && folder.children.length > 0;

        return (
          <div key={folder.id}>
            <div
              className={cn(
                'flex items-center py-2 px-3 cursor-pointer transition-colors',
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-md'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md',
              )}
              style={{ paddingLeft: `${depth * 20 + 12}px` }}
              onClick={() => setSelectedFolderId(folder.id)}
            >
              {hasChildren ? (
                <button
                  className="mr-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(folder.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <Folder className="w-4 h-4 mr-2 text-amber-500" />
              <span
                className={cn(
                  'text-sm truncate',
                  isSelected
                    ? 'text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300',
                )}
              >
                {folder.name}
              </span>
            </div>
            {isExpanded && folder.children && (
              <div>{renderFolderTree(folder.children, depth + 1)}</div>
            )}
          </div>
        );
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[400px] max-h-[500px] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">移动到</h3>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 根目录选项 */}
        <div
          className={cn(
            'flex items-center py-2 px-4 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700',
            selectedFolderId === null
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800',
          )}
          onClick={() => setSelectedFolderId(null)}
        >
          <Folder className="w-4 h-4 mr-2 text-blue-500" />
          <span
            className={cn(
              'text-sm',
              selectedFolderId === null
                ? 'text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-700 dark:text-gray-300',
            )}
          >
            我的文档库（根目录）
          </span>
        </div>

        {/* 文件夹列表 */}
        <div className="flex-1 overflow-y-auto py-2">
          {documentGroups.map((group) => (
            <div key={group.id}>
              {group.files.length > 0 ? (
                renderFolderTree(group.files)
              ) : (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">暂无文件夹</div>
              )}
            </div>
          ))}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
