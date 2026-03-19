import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarTab = 'home' | 'starred' | 'recent' | 'folder' | 'search' | 'trash';

interface SidebarState {
  isOpen: boolean;
  activeTab: SidebarTab;
  width: number;
  refreshTrigger: number;
  lastOperationSource: string | null; // 标识最后一次操作来源：'document-page' | 'sidebar' | null
  toggle: () => void;
  open: () => void;
  close: () => void;
  setActiveTab: (tab: SidebarTab) => void;
  setWidth: (width: number) => void;
  triggerRefresh: (source: string) => void;
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      activeTab: 'folder',
      width: 320,
      refreshTrigger: 0,
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
