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

interface FileState {
  documentGroups: FileDocumentGroup[];
  expandedFolders: Record<string, boolean>;
  expandedGroups: Record<string, boolean>;
  selectedFileId: string | null;
  isLoading: boolean;
  isRenaming: string | null;
  newItemFolder: string | null;
  newItemType: 'file' | 'folder' | null;
  newItemName: string;
  newItemGroupId: string | null;
  shareDialogOpen: boolean;
  shareDialogFile: FileItem | null;

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
  isRenaming: null,
  newItemFolder: null,
  newItemType: null,
  newItemName: '',
  newItemGroupId: null,
  shareDialogOpen: false,
  shareDialogFile: null,

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

    const userId = getCurrentUserId();
    if (!userId) {
      setIsLoading(false);
      return;
    }

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
          const findFileById = (items: FileItem[], id: string): boolean =>
            items.some(
              (item) => item.id === id || (item.children && findFileById(item.children, id)),
            );

          const fileExists = personalFiles.some((file) => findFileById([file], selectedFileId));
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
}));
