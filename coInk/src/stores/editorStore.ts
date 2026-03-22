import { create } from 'zustand';
import { Editor } from '@tiptap/react';

import { storage, STORAGE_KEYS } from '@/utils/storage/local-storage';

export type PageWidthMode = 'default' | 'wide' | 'full';

interface EditorState {
  editor: Editor | null;
  documentId: string | null;
  isContentItemMenuOpen: boolean;
  isHeaderHovered: boolean;
  pageWidthMode: PageWidthMode;
  /** 文档历史（快照）弹层，由菜单或 Header「最近修改」打开 */
  isHistoryPanelOpen: boolean;
}

interface EditorActions {
  setEditor: (editor: Editor, documentId: string) => void;
  clearEditor: () => void;
  setIsContentItemMenuOpen: (isOpen: boolean) => void;
  setIsHeaderHovered: (v: boolean) => void;
  setPageWidthMode: (mode: PageWidthMode) => void;
  setHistoryPanelOpen: (open: boolean) => void;
}

type EditorStore = EditorState & EditorActions;

function readStoredPageWidth(): PageWidthMode {
  if (typeof window === 'undefined') return 'default';
  const raw = storage.get(STORAGE_KEYS.EDITOR_PAGE_WIDTH) as PageWidthMode | 'narrow' | undefined;
  // 旧版键名 narrow 与当前「全宽 full」语义不同，迁移为 default，避免与 full 混用
  if (raw === 'narrow') {
    storage.set(STORAGE_KEYS.EDITOR_PAGE_WIDTH, 'default');
    return 'default';
  }
  if (raw === 'wide' || raw === 'full' || raw === 'default') return raw;

  return 'default';
}

export const useEditorStore = create<EditorStore>((set) => ({
  // State
  editor: null,
  documentId: null,
  isContentItemMenuOpen: false,
  isHeaderHovered: false,
  pageWidthMode: typeof window !== 'undefined' ? readStoredPageWidth() : 'default',
  isHistoryPanelOpen: false,

  // Actions
  setEditor: (editor, documentId) => set({ editor, documentId }),
  clearEditor: () => set({ editor: null, documentId: null, isHistoryPanelOpen: false }),
  setIsContentItemMenuOpen: (isOpen) => set({ isContentItemMenuOpen: isOpen }),
  setIsHeaderHovered: (v) => set({ isHeaderHovered: v }),
  setPageWidthMode: (mode) => {
    storage.set(STORAGE_KEYS.EDITOR_PAGE_WIDTH, mode);
    set({ pageWidthMode: mode });
  },
  setHistoryPanelOpen: (open) => set({ isHistoryPanelOpen: open }),
}));
