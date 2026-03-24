import { useState } from 'react';

import { toastSuccess, toastError, toastLoading } from '@/utils/toast';
import type { FileItem } from '@/types/file-system';
import { documentsApi } from '@/services/documents';

// 从 localStorage 获取当前用户ID
const getCurrentUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('cached_user_profile');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed.userId || null;
  } catch {
    return null;
  }
};

interface UseFileOperationsReturn {
  handleShare: (file: FileItem) => void;
  handleDownload: (file: FileItem) => Promise<void>;
  handleDuplicate: (file: FileItem) => Promise<void>;
  handleDelete: (file: FileItem) => Promise<void>;
  handleRename: (fileId: string, newName: string) => Promise<void>;
  handleCreate: (name: string, type: 'file' | 'folder', parentId?: string) => Promise<boolean>;
  showDeleteDialog: boolean;
  fileToDelete: FileItem | null;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useFileOperations = (refreshFiles: () => Promise<void>): UseFileOperationsReturn => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);

  // 处理文件分享
  const handleShare = (file: FileItem) => {
    // 这个会在主组件中处理，因为涉及到状态管理
    console.log('Share file:', file);
  };

  // 处理文件下载
  const handleDownload = async (file: FileItem) => {
    try {
      const response = await documentsApi.getById(file.id);

      if (response?.data) {
        // 创建下载链接
        const content = JSON.stringify(response.data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${file.name}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toastSuccess(`文件 "${file.name}" 下载成功`);
      }
    } catch (error) {
      console.error('下载文件失败:', error);
      toastError('下载文件失败，请重试');
    }
  };

  // 处理文件复制
  const handleDuplicate = async (file: FileItem) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        toastError('用户未登录，无法复制文件');
        return;
      }

      // Create a new document with similar title
      const response = await documentsApi.create({
        title: `${file.name} - 副本`,
        type: file.type === 'folder' ? 'FOLDER' : 'FILE',
        ownerId: userId,
      });

      if (response?.data) {
        // 刷新文件列表
        await refreshFiles();
        toastSuccess(`文件 "${file.name}" 已复制`);
      }
    } catch (error) {
      console.error('复制文件失败:', error);
      toastError('复制文件失败，请重试');
    }
  };

  // 处理文件删除
  const handleDelete = (file: FileItem) => {
    setFileToDelete(file);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    const toastId = toastLoading(`正在删除 "${fileToDelete.name}"...`);

    try {
      setShowDeleteDialog(false);

      const fileName = fileToDelete.name;
      const userId = getCurrentUserId();

      // 如果是文件且被收藏，先取消收藏
      if (fileToDelete.type === 'file' && fileToDelete.is_starred && userId) {
        await documentsApi.star(fileToDelete.id, { isStarred: false, userId });
      }

      await documentsApi.softDelete(fileToDelete.id);

      toastSuccess(`文件 "${fileName}" 已删除`, { id: toastId });
      // 先清空状态，再刷新列表
      setFileToDelete(null);
      await refreshFiles();
    } catch (error) {
      console.error('删除文件失败:', error);
      toastError('删除文件失败，请重试', { id: toastId });
      setFileToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  };

  // 处理文件重命名
  const handleRename = async (fileId: string, newName: string) => {
    try {
      await documentsApi.rename(fileId, { title: newName.trim() });

      // 刷新文件列表
      await refreshFiles();
      toastSuccess(`重命名成功`);
    } catch (error) {
      console.error('重命名失败:', error);
      toastError('重命名失败，请重试');
    }
  };

  // 处理文件创建
  const handleCreate = async (name: string, type: 'file' | 'folder', parentId?: string) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        toastError('用户未登录，无法创建文件');
        return false;
      }

      const response = await documentsApi.create({
        title: name.trim(),
        type: type === 'folder' ? 'FOLDER' : 'FILE',
        ownerId: userId,
        parentId: parentId,
      });

      if (response?.data) {
        // 刷新文件列表
        await refreshFiles();
        toastSuccess(`${type === 'folder' ? '文件夹' : '文件'} "${name}" 创建成功`);

        return true;
      }

      return false;
    } catch (error) {
      console.error('创建失败:', error);
      toastError(`创建${type === 'folder' ? '文件夹' : '文件'}失败，请重试`);

      return false;
    }
  };

  return {
    handleShare,
    handleDownload,
    handleDuplicate,
    handleDelete: async (file: FileItem) => {
      handleDelete(file);

      return new Promise<void>((resolve) => {
        // 这个 Promise 会在 confirmDelete 或 cancelDelete 中被处理
        resolve();
      });
    },
    handleRename,
    handleCreate,
    showDeleteDialog,
    fileToDelete,
    confirmDelete,
    cancelDelete,
  };
};
