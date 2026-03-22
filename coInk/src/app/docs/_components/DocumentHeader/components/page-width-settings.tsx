'use client';

import { HelpCircle } from 'lucide-react';

import { cn } from '@/utils';
import type { PageWidthMode } from '@/stores/editorStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSidebar } from '@/stores/sidebarStore';

/**
 * 段落行图标矢量（末行较短），与档位无关；宽度通过横向 scale 区分三档。
 * 实际正文列宽仍由编辑器 CSS 控制为约 75% / 85% / 95%。
 */
const PARAGRAPH_PAGE_WIDTH_ICON_PATH =
  'M888 268H136a56 56 0 0 1 0-112h752a56 56 0 0 1 0 112z m-752 200a56 56 0 0 1 0-112h752a56 56 0 0 1 0 112H136z m0 88h752a56 56 0 0 1 0 112H136a56 56 0 0 1 0-112z m0 200h464a56 56 0 0 1 0 112H136a56 56 0 0 1 0-112z';

/**
 * 以 viewBox 水平中心为锚横向缩放（仅示意图）。档位差拉大，接近飞书「窄 / 中 / 满」的对比。
 * 实际正文列宽仍由编辑器 CSS 控制。
 */
const MODE_PARAGRAPH_SCALE: Record<PageWidthMode, number> = {
  default: 0.48,
  wide: 0.78,
  full: 1.18,
};

/** 原矢量横条在 y 向较厚，仅压缩纵向，不改变横向档位比例 */
const PARAGRAPH_ICON_THIN_Y = 0.48;

/** 更多菜单「页宽设置」：FullWidthOutlined，与选项内段落示意区分 */
const FULL_WIDTH_MENU_ICON_PATH =
  'M3 2a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm4.5 11v1.692a.7.7 0 0 1-1.088.582l-4.038-2.691a.7.7 0 0 1 0-1.165l4.038-2.692a.7.7 0 0 1 1.088.582V11h9V9.308a.7.7 0 0 1 1.088-.582l4.038 2.692a.7.7 0 0 1 0 1.165l-4.038 2.691a.7.7 0 0 1-1.088-.582V13h-9ZM2 21a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Z';

export function PageWidthMenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-icon="FullWidthOutlined"
      className={cn('h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400', className)}
      aria-hidden
    >
      <path d={FULL_WIDTH_MENU_ICON_PATH} fill="currentColor" />
    </svg>
  );
}

function PageWidthPreviewIcon({ mode, selected }: { mode: PageWidthMode; selected: boolean }) {
  const scale = MODE_PARAGRAPH_SCALE[mode];

  return (
    <div
      className={cn(
        'flex w-full flex-col items-stretch justify-start overflow-visible rounded-md px-1 py-0.5',
        selected
          ? 'bg-blue-100/70 dark:bg-blue-950/45'
          : 'bg-neutral-100/90 dark:bg-neutral-800/70',
      )}
    >
      <svg
        viewBox="0 0 1024 1024"
        className="block h-[1.625rem] w-full min-w-0 max-w-none shrink-0 self-start"
        preserveAspectRatio="xMidYMin meet"
        aria-hidden
      >
        <g
          transform={`translate(512 512) scale(1 ${PARAGRAPH_ICON_THIN_Y}) translate(-512 -512)`}
        >
          <g transform={`translate(512 0) scale(${scale} 1) translate(-512 0)`}>
            <path
              d={PARAGRAPH_PAGE_WIDTH_ICON_PATH}
              className={cn(
                selected
                  ? 'fill-blue-600 dark:fill-blue-400'
                  : 'fill-gray-500 dark:fill-gray-400',
              )}
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

const OPTIONS: { id: PageWidthMode; label: string }[] = [
  { id: 'default', label: '默认' },
  { id: 'wide', label: '较宽' },
  { id: 'full', label: '全宽' },
];

export function PageWidthSettingsPanel() {
  const pageWidthMode = useEditorStore((s) => s.pageWidthMode);
  const setPageWidthMode = useEditorStore((s) => s.setPageWidthMode);
  const isSidebarOpen = useSidebar((s) => s.isOpen);

  return (
    <div className="box-border w-[min(calc(100vw_-_1.25rem),11.75rem)] max-w-full shrink-0 p-2.5">
      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <span>为当前窗口选择合适页宽</span>
        <button
          type="button"
          className="cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
          title="默认约 75%，较宽约 85%，全宽约 95%。左侧文档栏展开时编辑区固定为 95%，关闭后恢复所选档位。"
          aria-label="页宽说明"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
      {isSidebarOpen && (
        <p className="mb-3 rounded-md bg-muted/60 py-1.5 text-[11px] leading-snug text-muted-foreground">
          所选项会在关闭侧边栏后生效。
        </p>
      )}
      <div className="flex gap-2">
        {OPTIONS.map((opt) => {
          const selected = pageWidthMode === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPageWidthMode(opt.id)}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col items-stretch gap-1.5 rounded-lg border px-1.5 pb-1.5 pt-2 text-center transition-shadow duration-200',
                selected
                  ? 'border-blue-500 bg-blue-50/95 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-950/45 dark:text-blue-100'
                  : 'border-neutral-200/80 bg-white text-neutral-700 shadow-none hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)]',
              )}
            >
              <PageWidthPreviewIcon mode={opt.id} selected={selected} />
              <span
                className={cn(
                  'text-xs font-medium leading-none',
                  selected
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-neutral-800 dark:text-neutral-200',
                )}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
