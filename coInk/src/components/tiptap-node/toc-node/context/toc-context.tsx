import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  TableOfContentData,
  TableOfContentDataItem,
} from '@tiptap/extension-table-of-contents';

import { selectNodeAndHideFloating } from '@/hooks/use-floating-toolbar-visibility';

type TocState = {
  tocContent: TableOfContentData | null;
  setTocContent: (value: TableOfContentData | null) => void;

  navigateToHeading: (
    item: TableOfContentDataItem,
    options?: {
      topOffset?: number;
      behavior?: ScrollBehavior;
    },
  ) => void;

  normalizeHeadingDepths: <T extends { level?: number; originalLevel?: number }>(
    headingList: T[],
  ) => number[];
};

const TocContext = createContext<TocState | undefined>(undefined);

/**
 * Normalizes heading depths for a table of contents (TOC) structure.
 *
 * This function ensures proper hierarchical nesting where a heading can only be
 * a child of a previous heading with a smaller level number (higher priority).
 * It prevents incorrect structures like h2 being listed under h3.
 *
 * Algorithm:
 * 1. Rebases all levels so the minimum level becomes 1 (root level)
 * 2. For each heading, finds the most recent previous heading with a smaller level
 * 3. If found, nests it under that parent (parent depth + 1)
 * 4. If not found, treats it as a root-level item (depth = 1)
 *
 * @param items - Array of heading items with `level` or `originalLevel` properties
 * @returns Array of normalized depths corresponding to each heading item
 */
export function normalizeHeadingDepths<T extends { level?: number; originalLevel?: number }>(
  items: T[],
): number[] {
  if (items.length === 0) return [];

  const raw = items.map((h) => h.originalLevel ?? h.level ?? 1);

  // --- Determine root level ---
  const positives = raw.filter((l) => l > 0);
  const root = positives.includes(1) ? 1 : Math.min(...positives);

  // --- Rebase levels: root → 1 ---
  const lvl = raw.map((l) => Math.max(1, l - (root - 1)));

  const depths = new Array(items.length).fill(1);
  depths[0] = 1;

  for (let i = 1; i < lvl.length; i++) {
    const current = lvl[i] ?? 1;

    // Find the most recent heading with a smaller level (higher priority)
    let parentIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      const previous = lvl[j] ?? 1;
      if (previous < current) {
        parentIdx = j;
        break;
      }
    }

    // If we found a valid parent, nest under it
    // Otherwise, this is a root-level item
    depths[i] = parentIdx !== -1 ? depths[parentIdx] + 1 : 1;
  }

  return depths;
}

/**
 * 从节点向上查找第一个可纵向滚动的祖先；若无则退回 window（文档根滚动）。
 * 文档页编辑器在 overflow-y-auto 容器内，必须用该容器滚动，window.scrollTo 无效。
 */
export function getScrollableParent(element: HTMLElement | null): HTMLElement | Window {
  if (typeof window === 'undefined' || !element) return window;

  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    const scrollable =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight + 2;
    if (scrollable) return current;
    current = current.parentElement;
  }

  return window;
}

function scrollElementToOffset(
  element: HTMLElement,
  topOffset: number,
  behavior: ScrollBehavior,
) {
  const root = getScrollableParent(element);

  if (root === window) {
    const rect = element.getBoundingClientRect();
    const top = rect.top + window.scrollY - topOffset;
    window.scrollTo({ top: Math.max(0, top), behavior });
    return;
  }

  const scrollEl = root as HTMLElement;
  const elRect = element.getBoundingClientRect();
  const rootRect = scrollEl.getBoundingClientRect();
  const nextTop = elRect.top - rootRect.top + scrollEl.scrollTop - topOffset;
  scrollEl.scrollTo({ top: Math.max(0, nextTop), behavior });
}

/**
 * Low-level navigate helper (not exported in context directly)
 */
const doNavigateToHeading = (
  item: TableOfContentDataItem,
  topOffset: number,
  behavior: ScrollBehavior = 'smooth',
) => {
  if (typeof window === 'undefined') return;

  const el =
    item.dom ?? (item.id ? (document.getElementById(item.id) as HTMLElement | null) : null);
  if (!el) return;

  scrollElementToOffset(el, topOffset, behavior);

  if (item.editor && typeof item.pos === 'number') {
    selectNodeAndHideFloating(item.editor, item.pos);
  }

  if (item.id) {
    const url = new URL(window.location.href);
    url.hash = item.id;
    window.history.replaceState(null, '', url.toString());
  }
};

export const TocProvider = ({ children }: { children: ReactNode }) => {
  const [tocContent, setTocContent] = useState<TableOfContentData | null>(null);

  const navigateToHeading = useCallback<TocState['navigateToHeading']>((item, options) => {
    const topOffset = options?.topOffset ?? 0;
    const behavior = options?.behavior ?? 'smooth';
    doNavigateToHeading(item, topOffset, behavior);
  }, []);

  return (
    <TocContext.Provider
      value={{
        tocContent,
        setTocContent,
        navigateToHeading,
        normalizeHeadingDepths,
      }}
    >
      {children}
    </TocContext.Provider>
  );
};

export const useToc = () => {
  const ctx = useContext(TocContext);
  if (!ctx) {
    throw new Error('useToc must be used inside <TocProvider>');
  }
  return ctx;
};
