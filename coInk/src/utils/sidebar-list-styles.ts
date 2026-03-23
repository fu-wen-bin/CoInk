/**
 * 侧边栏文档列表：
 * - 悬浮：灰色底
 * - 选中 / 当前打开：浅蓝底（与此前选中态一致）
 */
export const SIDEBAR_LIST_ROW_HOVER = 'hover:bg-gray-100 dark:hover:bg-gray-800' as const;

export const SIDEBAR_LIST_ROW_SELECTED = 'bg-[#EBF2FF] dark:bg-blue-950/35' as const;

/** 共享的文档：当前行 / 批量选中（紫色体系） */
export const SIDEBAR_LIST_ROW_HOVER_SHARED =
  'hover:bg-violet-50 dark:hover:bg-violet-950/30' as const;
export const SIDEBAR_LIST_ROW_SELECTED_SHARED = 'bg-violet-50 dark:bg-violet-950/35' as const;
