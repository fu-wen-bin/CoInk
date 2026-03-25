import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarTab = 'home' | 'starred' | 'recent' | 'folder' | 'search' | 'trash';

interface SidebarState {
  isOpen: boolean;
  activeTab: SidebarTab;
  width: number;
  refreshTrigger: number;
  /** 收藏列表刷新计数：主页/其它处收藏成功后递增，侧边栏「收藏的文档」订阅以重新拉取 */
  starredListVersion: number;
  /** 「与我共享」列表刷新计数 */
  sharedListVersion: number;
  /** 「我的文档库」刷新计数 */
  libraryListVersion: number;
  /** 侧边栏「收藏的文档」批量选择模式（与文档库批量互斥） */
  starredBatchMode: boolean;
  starredSelectedIds: string[];
  /** 「共享的文档」批量模式（与文档库、收藏批量互斥） */
  sharedBatchMode: boolean;
  sharedSelectedIds: string[];
  /** 用于侧栏单行高亮优先级：收藏 / 共享列表快照 */
  starredDocumentIds: string[];
  sharedDocumentIds: string[];
  lastOperationSource: string | null; // 标识最后一次操作来源：'document-page' | 'sidebar' | null
  toggle: () => void;
  open: () => void;
  close: () => void;
  setActiveTab: (tab: SidebarTab) => void;
  setWidth: (width: number) => void;
  triggerRefresh: (source: string) => void;
  bumpStarredList: () => void;
  bumpSharedList: () => void;
  bumpLibraryList: () => void;
  setStarredBatchMode: (v: boolean) => void;
  toggleStarredSelection: (id: string) => void;
  setStarredSelectedIds: (ids: string[]) => void;
  clearStarredSelection: () => void;
  filterStarredSelection: (validIds: Set<string>) => void;
  /** 进入收藏批量模式并全选当前列表 id（由 StarredView 调用） */
  enterStarredBatchWithAll: (ids: string[]) => void;
  setSharedBatchMode: (v: boolean) => void;
  toggleSharedSelection: (id: string) => void;
  setSharedSelectedIds: (ids: string[]) => void;
  clearSharedSelection: () => void;
  filterSharedSelection: (validIds: Set<string>) => void;
  enterSharedBatchWithAll: (ids: string[]) => void;
  setStarredDocumentIds: (ids: string[]) => void;
  setSharedDocumentIds: (ids: string[]) => void;
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      activeTab: 'folder',
      width: 320,
      refreshTrigger: 0,
      starredListVersion: 0,
      sharedListVersion: 0,
      libraryListVersion: 0,
      starredBatchMode: false,
      starredSelectedIds: [] as string[],
      sharedBatchMode: false,
      sharedSelectedIds: [] as string[],
      starredDocumentIds: [] as string[],
      sharedDocumentIds: [] as string[],
      lastOperationSource: null as string | null,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActiveTab: (tab: SidebarTab) => set({ activeTab: tab }),
      setWidth: (width: number) => set({ width }),
      triggerRefresh: (source: string = 'unknown') =>
        set((state) => ({
          refreshTrigger: state.refreshTrigger + 1,
          lastOperationSource: source,
        })),
      bumpStarredList: () => set((state) => ({ starredListVersion: state.starredListVersion + 1 })),
      bumpSharedList: () => set((state) => ({ sharedListVersion: state.sharedListVersion + 1 })),
      bumpLibraryList: () => set((state) => ({ libraryListVersion: state.libraryListVersion + 1 })),
      setStarredBatchMode: (v) =>
        set((state) => ({
          starredBatchMode: v,
          starredSelectedIds: v ? state.starredSelectedIds : [],
          ...(v ? { sharedBatchMode: false, sharedSelectedIds: [] as string[] } : {}),
        })),
      enterStarredBatchWithAll: (ids) =>
        set({
          starredBatchMode: true,
          starredSelectedIds: ids,
          sharedBatchMode: false,
          sharedSelectedIds: [],
        }),
      toggleStarredSelection: (id) =>
        set((state) => {
          const has = state.starredSelectedIds.includes(id);
          return {
            starredSelectedIds: has
              ? state.starredSelectedIds.filter((x) => x !== id)
              : [...state.starredSelectedIds, id],
          };
        }),
      setStarredSelectedIds: (ids) => set({ starredSelectedIds: ids }),
      clearStarredSelection: () => set({ starredSelectedIds: [], starredBatchMode: false }),
      filterStarredSelection: (validIds) =>
        set((state) => ({
          starredSelectedIds: state.starredSelectedIds.filter((id) => validIds.has(id)),
        })),
      setSharedBatchMode: (v) =>
        set((state) => ({
          sharedBatchMode: v,
          sharedSelectedIds: v ? state.sharedSelectedIds : [],
          ...(v ? { starredBatchMode: false, starredSelectedIds: [] as string[] } : {}),
        })),
      enterSharedBatchWithAll: (ids) =>
        set({
          sharedBatchMode: true,
          sharedSelectedIds: ids,
          starredBatchMode: false,
          starredSelectedIds: [],
        }),
      toggleSharedSelection: (id) =>
        set((state) => {
          const has = state.sharedSelectedIds.includes(id);
          return {
            sharedSelectedIds: has
              ? state.sharedSelectedIds.filter((x) => x !== id)
              : [...state.sharedSelectedIds, id],
          };
        }),
      setSharedSelectedIds: (ids) => set({ sharedSelectedIds: ids }),
      clearSharedSelection: () => set({ sharedSelectedIds: [], sharedBatchMode: false }),
      filterSharedSelection: (validIds) =>
        set((state) => ({
          sharedSelectedIds: state.sharedSelectedIds.filter((id) => validIds.has(id)),
        })),
      setStarredDocumentIds: (ids) => set({ starredDocumentIds: ids }),
      setSharedDocumentIds: (ids) => set({ sharedDocumentIds: ids }),
    }),
    {
      name: 'sidebar-state', // localStorage key
      partialize: (state) => ({
        isOpen: state.isOpen,
        activeTab: state.activeTab,
        width: state.width,
        refreshTrigger: state.refreshTrigger,
        lastOperationSource: state.lastOperationSource,
      }),
    },
  ),
);
