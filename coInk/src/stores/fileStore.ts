import { create } from 'zustand';

import type { FileItem } from '@/types/file-system';
import { documentsApi } from '@/services/documents';
import type { Document } from '@/services/documents/types';

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

export interface FileDocumentGroup {
  id: string;
  name: string;
  type: 'personal';
  files: FileItem[];
}

// 别名导出，兼容旧代码
export type DocumentGroup = FileDocumentGroup;

interface FileState {
  documentGroups: FileDocumentGroup[];
  expandedFolders: Record<string, boolean>;
  expandedGroups: Record<string, boolean>;
  selectedFileId: string | null;
  isLoading: boolean;
  isRenaming: string | null;
  isLoadingFiles: boolean;
  newItemFolder: string | null;
  newItemType: 'file' | 'folder' | null;
  newItemName: string;
  newItemGroupId: string | null;
  shareDialogOpen: boolean;
  shareDialogFile: FileItem | null;
  // 批量选择
  batchMode: boolean;
  selectedItems: string[];

  setDocumentGroups: (groups: FileDocumentGroup[]) => void;
  setExpandedFolders: (folders: Record<string, boolean>) => void;
  setExpandedGroups: (groups: Record<string, boolean>) => void;
  setSelectedFileId: (id: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  toggleFolder: (folderId: string) => void;
  toggleGroup: (groupId: string) => void;
  collapseAll: () => void;
  setIsRenaming: (id: string | null) => void;
  setNewItemFolder: (id: string | null) => void;
  setNewItemType: (type: 'file' | 'folder' | null) => void;
  setNewItemName: (name: string) => void;
  setNewItemGroupId: (groupId: string | null) => void;
  setShareDialogOpen: (open: boolean) => void;
  setShareDialogFile: (file: FileItem | null) => void;
  // 批量选择
  setBatchMode: (mode: boolean) => void;
  toggleItemSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  /** 仅更新批量选中 id，不退出批量模式（用于全选/取消全选） */
  setBatchSelectedItems: (ids: string[]) => void;
  // 批量操作
  batchCopy: () => Promise<void>;
  batchMove: (targetFolderId: string | null) => Promise<void>;
  batchDelete: () => Promise<void>;
  /** 协同落库后更新侧栏中该文件的 `updated_at`（无需整页刷新） */
  patchDocumentUpdatedAt: (documentId: string, updatedAt: string) => void;
  /** 收藏状态变更后同步「我的文档库」树节点（与 document_user_star 一致） */
  patchDocumentStarred: (documentId: string, isStarred: boolean) => void;
  loadFiles: (isInitialLoad?: boolean) => Promise<void>;
  processApiDocuments: (documents: Document[]) => FileItem[];
  createNewItem: (name: string, type: 'file' | 'folder', parentId?: string) => Promise<boolean>;
  finishCreateNewItem: () => Promise<void>;
  cancelCreateNewItem: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  documentGroups: [],
  expandedFolders: {},
  expandedGroups: { personal: true },
  selectedFileId: null,
  isLoading: true,
  isLoadingFiles: false,
  isRenaming: null,
  newItemFolder: null,
  newItemType: null,
  newItemName: '',
  newItemGroupId: null,
  shareDialogOpen: false,
  shareDialogFile: null,
  // 批量选择
  batchMode: false,
  selectedItems: [],

  setDocumentGroups: (groups) => set({ documentGroups: groups }),
  setExpandedFolders: (folders) => set({ expandedFolders: folders }),
  setExpandedGroups: (groups) => set({ expandedGroups: groups }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  toggleFolder: (folderId) =>
    set((state) => ({
      expandedFolders: {
        ...state.expandedFolders,
        [folderId]: !state.expandedFolders[folderId],
      },
    })),
  toggleGroup: (groupId) =>
    set((state) => ({
      expandedGroups: {
        ...state.expandedGroups,
        [groupId]: !state.expandedGroups[groupId],
      },
    })),
  collapseAll: () => set({ expandedFolders: {}, expandedGroups: {} }),
  setIsRenaming: (id) => set({ isRenaming: id }),
  setNewItemFolder: (id) => set({ newItemFolder: id }),
  setNewItemType: (type) => set({ newItemType: type }),
  setNewItemName: (name) => set({ newItemName: name }),
  setNewItemGroupId: (groupId) => set({ newItemGroupId: groupId }),
  setShareDialogOpen: (open) => set({ shareDialogOpen: open }),
  setShareDialogFile: (file) => set({ shareDialogFile: file }),
  // 批量选择
  setBatchMode: (mode) => set({ batchMode: mode }),
  toggleItemSelection: (id) =>
    set((state) => {
      const idStr = String(id);
      const exists = state.selectedItems.some((item) => String(item) === idStr);
      return {
        selectedItems: exists
          ? state.selectedItems.filter((item) => String(item) !== idStr)
          : [...state.selectedItems, idStr],
      };
    }),
  /** 仅退出批量选择，保留当前打开文档的侧栏高亮（与 URL 一致） */
  clearSelection: () => set({ selectedItems: [], batchMode: false }),
  selectAll: () => {
    const { documentGroups } = get();
    const allIds: string[] = [];
    const collectIds = (items: FileItem[]) => {
      items.forEach((item) => {
        allIds.push(String(item.id));
        if (item.children) collectIds(item.children);
      });
    };
    documentGroups.forEach((group) => collectIds(group.files));
    set({ selectedItems: allIds });
  },
  setBatchSelectedItems: (ids) => set({ selectedItems: ids.map(String) }),

  processApiDocuments: (documents) => {
    const docMap = new Map<string, Document>();
    documents.forEach((doc) => docMap.set(doc.documentId, doc));

    const result: FileItem[] = [];
    const childrenMap = new Map<string, FileItem[]>();
    docMap.forEach((doc) => childrenMap.set(doc.documentId, []));

    docMap.forEach((doc) => {
      const fileItem: FileItem = {
        id: doc.documentId,
        name: doc.title,
        type: doc.type === 'FOLDER' ? 'folder' : 'file',
        order: doc.sortOrder,
        is_starred: doc.isStarred,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
        depth: 0,
      };

      if (doc.type === 'FOLDER') {
        fileItem.children = childrenMap.get(doc.documentId) || [];
      }

      if (doc.parentId === null) {
        result.push(fileItem);
      } else if (doc.parentId && docMap.has(doc.parentId)) {
        const parentChildren = childrenMap.get(doc.parentId) || [];
        parentChildren.push(fileItem);
        childrenMap.set(doc.parentId, parentChildren);
      }
    });

    const setDepthRecursively = (items: FileItem[], depth = 0) => {
      items.forEach((item) => {
        item.depth = depth;
        if (item.children?.length) setDepthRecursively(item.children, depth + 1);
      });
    };

    setDepthRecursively(result);
    return result;
  },

  loadFiles: async (isInitialLoad = false) => {
    const {
      selectedFileId,
      processApiDocuments,
      setDocumentGroups,
      setExpandedFolders,
      setExpandedGroups,
      setSelectedFileId,
      setIsLoading,
    } = get();

    // 防止并发调用
    if (get().isLoadingFiles) {
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      setIsLoading(false);
      return;
    }

    set({ isLoadingFiles: true });
    setIsLoading(true);

    try {
      const docsResult = await documentsApi.getMyDocuments(userId);

      if (docsResult?.data?.data) {
        const documents = docsResult.data.data;
        const personalFiles =
          Array.isArray(documents) && documents.length ? processApiDocuments(documents) : [];

        setDocumentGroups([
          {
            id: 'personal',
            name: '个人文档',
            type: 'personal',
            files: personalFiles,
          },
        ]);

        if (!isInitialLoad && selectedFileId) {
          const selectedIdStr = String(selectedFileId);
          const findFileById = (items: FileItem[], id: string): boolean =>
            items.some(
              (item) =>
                String(item.id) === id || (item.children && findFileById(item.children, id)),
            );

          const fileExists = personalFiles.some((file) => findFileById([file], selectedIdStr));
          if (!fileExists) setSelectedFileId(null);
        }

        if (isInitialLoad) {
          const initialExpandedFolders: Record<string, boolean> = {};
          personalFiles
            .filter((file) => file.type === 'folder')
            .forEach((folder) => {
              initialExpandedFolders[folder.id] = true;
            });

          setExpandedFolders(initialExpandedFolders);
          setExpandedGroups({ personal: true });
        }
      }
    } catch (error) {
      console.error('加载文档列表失败:', error);
    } finally {
      set({ isLoadingFiles: false });
      setIsLoading(false);
    }
  },

  createNewItem: async (name, type, parentId) => {
    const userId = getCurrentUserId();
    if (!userId) return false;

    const res = await documentsApi.create({
      title: name,
      type: type === 'folder' ? 'FOLDER' : 'FILE',
      ownerId: userId,
      parentId,
    });

    if (res?.data) {
      await get().loadFiles(false);
      return true;
    }
    return false;
  },

  finishCreateNewItem: async () => {
    const {
      newItemName,
      newItemType,
      newItemFolder,
      newItemGroupId,
      createNewItem,
      setNewItemFolder,
      setNewItemType,
      setNewItemGroupId,
    } = get();

    if (!newItemFolder || !newItemType || !newItemName.trim() || !newItemGroupId) {
      setNewItemFolder(null);
      setNewItemType(null);
      setNewItemGroupId(null);
      return;
    }

    const success = await createNewItem(
      newItemName,
      newItemType,
      newItemFolder === 'root' ? undefined : newItemFolder,
    );
    if (success) {
      setNewItemFolder(null);
      setNewItemType(null);
      setNewItemGroupId(null);
    }
  },

  cancelCreateNewItem: () => set({ newItemFolder: null, newItemType: null, newItemGroupId: null }),

  // 批量操作方法
  batchCopy: async () => {
    const { selectedItems, documentGroups, loadFiles } = get();
    const userId = getCurrentUserId();
    if (!userId || selectedItems.length === 0) return;

    // 获取所有选中的文件信息
    const filesToCopy: FileItem[] = [];
    const findFiles = (items: FileItem[]) => {
      items.forEach((item) => {
        if (selectedItems.includes(item.id)) {
          filesToCopy.push(item);
        }
        if (item.children) findFiles(item.children);
      });
    };
    documentGroups.forEach((group) => findFiles(group.files));

    // 复制每个文件
    for (const file of filesToCopy) {
      await documentsApi.create({
        title: `${file.name}_copy`,
        type: file.type === 'folder' ? 'FOLDER' : 'FILE',
        ownerId: userId,
        parentId: undefined, // 复制到根目录
      });
    }

    // 清空选择并刷新
    set({ selectedItems: [], batchMode: false });
    await loadFiles(false);
  },

  batchMove: async (targetFolderId: string | null) => {
    const { selectedItems, loadFiles } = get();
    const userId = getCurrentUserId();
    if (!userId || selectedItems.length === 0) return;

    // 移动每个文件
    for (const id of selectedItems) {
      await documentsApi.move(id, {
        parentId: targetFolderId as string,
        userId,
      });
    }

    // 清空选择并刷新
    set({ selectedItems: [], batchMode: false });
    await loadFiles(false);
  },

  batchDelete: async () => {
    const { selectedItems, loadFiles, documentGroups } = get();
    if (selectedItems.length === 0) return;

    const userId = getCurrentUserId();

    // 收集所有被选中的文件（包括子文件夹中的文件）
    const collectSelectedFiles = (items: FileItem[]): FileItem[] => {
      const result: FileItem[] = [];
      for (const item of items) {
        if (selectedItems.includes(item.id)) {
          result.push(item);
        }
        if (item.children) {
          result.push(...collectSelectedFiles(item.children));
        }
      }
      return result;
    };

    const allSelectedFiles: FileItem[] = [];
    for (const group of documentGroups) {
      allSelectedFiles.push(...collectSelectedFiles(group.files));
    }

    // 软删除每个文件，如果被收藏则先取消收藏
    for (const file of allSelectedFiles) {
      // 如果是文件且被收藏，先取消收藏
      if (file.type === 'file' && file.is_starred && userId) {
        await documentsApi.star(file.id, { isStarred: false, userId });
      }
      await documentsApi.softDelete(file.id);
    }

    // 清空选择并刷新
    set({ selectedItems: [], batchMode: false });
    await loadFiles(false);
  },

  patchDocumentUpdatedAt: (documentId, updatedAt) => {
    const { documentGroups } = get();
    const idStr = String(documentId);

    const patchTree = (items: FileItem[]): FileItem[] =>
      items.map((item) => {
        if (String(item.id) === idStr) {
          return { ...item, updated_at: updatedAt };
        }
        if (item.children?.length) {
          return { ...item, children: patchTree(item.children) };
        }
        return item;
      });

    set({
      documentGroups: documentGroups.map((g) => ({
        ...g,
        files: patchTree(g.files),
      })),
    });
  },

  patchDocumentStarred: (documentId, isStarred) => {
    const { documentGroups } = get();
    const idStr = String(documentId);

    const patchTree = (items: FileItem[]): FileItem[] =>
      items.map((item) => {
        if (String(item.id) === idStr) {
          return { ...item, is_starred: isStarred };
        }
        if (item.children?.length) {
          return { ...item, children: patchTree(item.children) };
        }
        return item;
      });

    set({
      documentGroups: documentGroups.map((g) => ({
        ...g,
        files: patchTree(g.files),
      })),
    });
  },
}));
