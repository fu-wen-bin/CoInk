'use client';

import React, { useEffect, useRef, startTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { closestCenter, DndContext, MeasuringStrategy, PointerSensor } from '@dnd-kit/core';
import { useSensor, useSensors } from '@dnd-kit/core';
import { Folder as FolderIcon } from 'lucide-react';

import ShareDialog from './ShareDialog';
import GroupedFileTree from './components/GroupedFileTree';
import Toolbar from './components/Toolbar';
import ContextMenu from './components/ContextMenu';
import LoadingSkeleton from './components/LoadingSkeleton';
import { useFileOperations } from './hooks/useFileOperations';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useContextMenu } from './hooks/useContextMenu';

import { FileExplorerProps, FileItem } from '@/types/file-system';
import { useSidebar } from '@/stores/sidebarStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DocumentGroup, useFileStore } from '@/stores/fileStore';
import { flattenTreeFile, getProjection, removeChildrenOf } from '@/utils';

export const TRASH_ID = 'void';

const Folder = ({ onFileSelect, compact }: FileExplorerProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { refreshTrigger, lastOperationSource, triggerRefresh } = useSidebar();
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用 Zustand stores
  const {
    documentGroups,
    expandedFolders,
    expandedGroups,
    selectedFileId,
    isRenaming,
    newItemFolder,
    newItemGroupId,
    newItemType,
    newItemName,
    shareDialogOpen,
    shareDialogFile,
    isLoading,
    setSelectedFileId,
    setIsRenaming,
    setNewItemFolder,
    setNewItemType,
    setNewItemName,
    setNewItemGroupId,
    setShareDialogOpen,
    setShareDialogFile,
    toggleFolder: storeToggleFolder,
    toggleGroup,
    collapseAll,
    loadFiles,
    finishCreateNewItem,
    cancelCreateNewItem,
  } = useFileStore();

  // 文件夹操作
  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // 如果文件夹当前是展开的，关闭时取消该文件夹下的新建操作
    if (expandedFolders[folderId] && newItemFolder === folderId) {
      cancelCreateNewItem();
    }

    storeToggleFolder(folderId);
  };

  // 使用自定义 hooks
  const refreshFiles = () => loadFiles(false);
  const fileOperations = useFileOperations(refreshFiles);
  const {
    contextMenuPosition,
    contextMenuTargetId,
    handleContextMenu,
    closeContextMenu,
    findTargetFile,
  } = useContextMenu();

  const memoFileList = (() => {
    // 将所有分组的文件合并到一个列表中以支持拖放
    const allFiles: FileItem[] = [];
    documentGroups.forEach((group) => {
      allFiles.push(...group.files);
    });

    const flattenFile = flattenTreeFile(allFiles);
    const expandedFiles = flattenFile.reduce<string[]>((acc, item) => {
      if (!expandedFolders[item.id] && item.children && item.children.length > 0) {
        return [...acc, item.id];
      } else {
        return [...acc];
      }
    }, []);

    const items = removeChildrenOf(flattenFile, expandedFiles);

    return items;
  })();

  // 使用拖拽钩子
  const { dndState, onDragStart, onDragOver, onDragMove, handleDragEnd } = useDragAndDrop(
    memoFileList,
    expandedFolders,
    loadFiles,
    toggleFolder,
  );

  useEffect(() => {
    loadFiles(true);
  }, [loadFiles]);

  // 监听 refreshTrigger 变化，当从外部触发刷新时重新加载文件列表
  useEffect(() => {
    if (refreshTrigger > 0 && lastOperationSource !== 'side') {
      loadFiles(true);
    }
  }, [refreshTrigger, lastOperationSource, loadFiles]);

  // URL选中逻辑 - 从URL参数识别当前选中的文档
  useEffect(() => {
    const match = pathname.match(/^\/docs\/(\d+)$/);

    if (match) {
      const fileId = String(match[1]);
      setSelectedFileId(fileId);
    } else {
      setSelectedFileId(null);
    }
  }, [pathname, setSelectedFileId]);

  // 当文件列表加载完成后，验证选中的文件是否存在
  useEffect(() => {
    if (documentGroups.length === 0 || !selectedFileId) return;

    const selectedIdStr = String(selectedFileId);

    const findFileById = (items: FileItem[], id: string): boolean => {
      for (const item of items) {
        if (String(item.id) === id) return true;
        if (item.children && findFileById(item.children, id)) return true;
      }
      return false;
    };

    let found = false;
    for (const group of documentGroups) {
      if (findFileById(group.files, selectedIdStr)) {
        found = true;
        break;
      }
    }

    if (!found) {
      setSelectedFileId(null);
    }
  }, [documentGroups, selectedFileId, setSelectedFileId]);

  // 文件选择 - 使用 startTransition 优化导航，避免页面闪烁
  const handleFileSelect = (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileId(String(file.id));

    if (file.type === 'file') {
      // 使用 startTransition 让导航在后台执行，避免阻塞 UI
      startTransition(() => {
        router.push(`/docs/${file.id}`, { scroll: false });
      });
    }

    if (onFileSelect) onFileSelect(file);
  };

  // 重命名
  const startRenaming = (fileId: string) => {
    setIsRenaming(fileId);
    closeContextMenu();
  };

  const finishRenaming = async (newName: string) => {
    if (!isRenaming || !newName.trim()) {
      setIsRenaming(null);

      return;
    }

    try {
      await fileOperations.handleRename(isRenaming, newName);
      setIsRenaming(null);
    } catch (error) {
      console.error('Failed to rename:', error);
      setIsRenaming(null);
    }
  };

  // 新建文件/文件夹
  const startCreateNewItem = (folderId: string, type: 'file' | 'folder', groupId: string) => {
    setNewItemFolder(folderId);
    setNewItemType(type);
    setNewItemName('');
    setNewItemGroupId(groupId);
    closeContextMenu();
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isRenaming) {
        finishRenaming((e.target as HTMLInputElement).value);
      } else if (newItemFolder) {
        finishCreateNewItem().then(() => triggerRefresh('side'));
      }
    } else if (e.key === 'Escape') {
      if (isRenaming) setIsRenaming(null);
      if (newItemFolder) cancelCreateNewItem();
    }
  };

  const handleShare = (file: FileItem) => {
    setShareDialogFile(file);
    setShareDialogOpen(true);
  };

  const handleRename = (file: FileItem) => {
    startRenaming(file.id);
  };

  const sensor = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const projected =
    dndState.activeId && dndState.overId
      ? getProjection(
          memoFileList,
          dndState.activeId,
          dndState.overId,
          expandedFolders,
          dndState.offsetLeft,
          16,
        )
      : null;

  // 在所有分组中查找目标文件
  const targetFile = contextMenuTargetId
    ? (() => {
        for (const group of documentGroups) {
          const found = findTargetFile(group.files);
          if (found) return found;
        }

        return null;
      })()
    : null;

  // 递归查找第一个文件
  const findFirstFile = (items: FileItem[]): string | null => {
    for (const item of items) {
      if (item.type === 'file') return item.id;

      if (item.children && item.children.length > 0) {
        const found = findFirstFile(item.children);
        if (found) return found;
      }
    }

    return null;
  };

  // 查找所有分组中的第一个文件 ID
  const findFirstFileIdInGroups = (groups: DocumentGroup[]): string | null => {
    for (const group of groups) {
      const firstFileId = findFirstFile(group.files);
      if (firstFileId) return firstFileId;
    }

    return null;
  };

  // 确认删除
  const handleConfirm = async () => {
    try {
      await fileOperations.confirmDelete();
      await triggerRefresh('side');

      // 重新加载文件列表
      await loadFiles(false);

      // 等待状态更新
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 从更新后的 documentGroups 中查找第一个文件
      const firstFileId = findFirstFileIdInGroups(documentGroups);

      if (firstFileId) {
        setSelectedFileId(firstFileId);
        router.push(`/docs/${firstFileId}`);
      } else {
        setSelectedFileId(null);
        router.push('/docs');
      }
    } catch (error) {
      console.error('删除操作失败:', error);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col flex-1 h-full">
      {/* 头部工具栏 - 非紧凑模式下显示 */}
      {!compact && (
        <Toolbar
          onCreateFile={() => {
            // 默认在个人文档分组创建
            const personalGroup = documentGroups.find((g) => g.type === 'personal');

            if (personalGroup) {
              startCreateNewItem('root', 'file', personalGroup.id);
            }
          }}
          onCreateFolder={() => {
            // 默认在个人文档分组创建
            const personalGroup = documentGroups.find((g) => g.type === 'personal');

            if (personalGroup) {
              startCreateNewItem('root', 'folder', personalGroup.id);
            }
          }}
          onRefresh={refreshFiles}
          onCollapseAll={collapseAll}
          isLoading={isLoading}
        />
      )}

      {/* 拖拽上下文 */}
      <DndContext
        sensors={sensor}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={handleDragEnd}
        onDragMove={onDragMove}
      >
        {/* 文件树区域 */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent relative"
          onClick={(e) => {
            // 检查点击的是否是新建输入框区域
            const target = e.target as HTMLElement;
            const isNewItemInput = target.closest('[data-new-item-container]');

            if (!isNewItemInput) {
              closeContextMenu();
              if (isRenaming) setIsRenaming(null);

              if (newItemFolder) {
                setNewItemFolder(null);
                setNewItemType(null);
              }
            }
          }}
        >
          {/* 根据加载状态和文件数量显示不同内容 */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            (() => {
              // 检查是否所有分组都没有文件
              const hasAnyFiles = documentGroups.some((group) => group.files.length > 0);
              const isCompletelyEmpty = documentGroups.length === 0 || !hasAnyFiles;

              return isCompletelyEmpty && !newItemFolder ? (
                <div className="flex flex-col items-center justify-center text-gray-400 h-40">
                  <FolderIcon className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">暂无文档</p>
                </div>
              ) : (
                <>
                  {/* 加载指示器 */}
                  {isLoading && (
                    <div className="absolute top-2 right-2 z-10">
                      <div className="flex items-center space-x-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-slate-200/50 dark:border-slate-600/50">
                        <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          刷新中...
                        </span>
                      </div>
                    </div>
                  )}

                  <GroupedFileTree
                    groups={documentGroups}
                    projected={projected}
                    expandedFolders={expandedFolders}
                    expandedGroups={expandedGroups}
                    selectedFileId={selectedFileId}
                    dndState={dndState}
                    isRenaming={isRenaming}
                    newItemFolder={newItemFolder}
                    newItemGroupId={newItemGroupId}
                    newItemType={newItemType}
                    newItemName={newItemName}
                    onFileSelect={handleFileSelect}
                    onToggleFolder={toggleFolder}
                    onToggleGroup={toggleGroup}
                    onContextMenu={handleContextMenu}
                    closeContextMenu={closeContextMenu}
                    onStartCreateNewItem={startCreateNewItem}
                    onFinishRenaming={finishRenaming}
                    onFinishCreateNewItem={() =>
                      finishCreateNewItem().then(() => triggerRefresh('side'))
                    }
                    onCancelCreateNewItem={cancelCreateNewItem}
                    onKeyDown={handleKeyDown}
                    onSetNewItemName={setNewItemName}
                    onShare={handleShare}
                    onDelete={fileOperations.handleDelete}
                    onRename={handleRename}
                    onDuplicate={fileOperations.handleDuplicate}
                    onDownload={fileOperations.handleDownload}
                  />
                </>
              );
            })()
          )}
        </div>
      </DndContext>

      {/* 右键菜单 */}
      <ContextMenu
        position={contextMenuPosition}
        targetFile={targetFile}
        containerRef={containerRef}
        onClose={closeContextMenu}
        onCreateFile={(folderId) => {
          // 找到文件所属的分组
          let groupId = 'personal';

          for (const group of documentGroups) {
            const found = findTargetFile(group.files);

            if (found) {
              groupId = group.id;
              break;
            }
          }

          startCreateNewItem(folderId, 'file', groupId);
        }}
        onCreateFolder={(folderId) => {
          // 找到文件所属的分组
          let groupId = 'personal';

          for (const group of documentGroups) {
            const found = findTargetFile(group.files);

            if (found) {
              groupId = group.id;
              break;
            }
          }

          startCreateNewItem(folderId, 'folder', groupId);
        }}
        onRename={(fileId) => startRenaming(fileId)}
      />

      {/* 分享对话框 */}
      {shareDialogFile && (
        <ShareDialog
          file={shareDialogFile}
          isOpen={shareDialogOpen}
          onClose={() => {
            setShareDialogOpen(false);
            setShareDialogFile(null);
          }}
        />
      )}

      {/* 删除确认对话框 */}
      <Dialog open={fileOperations.showDeleteDialog} onOpenChange={fileOperations.cancelDelete}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden bg-white/95 backdrop-blur-sm border border-slate-200/50 shadow-lg transition-all">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center space-x-2 text-red-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-bounce"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>确认删除</span>
            </DialogTitle>
            <DialogDescription className="mt-3 text-slate-600">
              您确定要删除{' '}
              <span className="font-medium text-slate-900">
                "{fileOperations.fileToDelete?.name}"
              </span>{' '}
              吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-4 bg-slate-50/50 border-t border-slate-200/50 flex space-x-3">
            <Button
              variant="outline"
              onClick={fileOperations.cancelDelete}
              className="flex-1 bg-transparent hover:bg-slate-100 transition-colors"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Folder;
