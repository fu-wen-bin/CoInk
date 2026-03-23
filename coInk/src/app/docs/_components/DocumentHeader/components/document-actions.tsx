'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  FileText,
  FileType,
  History,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react';

import type { DocumentActionsProps } from '../types';
import { PageWidthMenuIcon, PageWidthSettingsPanel } from './page-width-settings';

import { useCommentStore } from '@/stores/commentStore';
import { cn, handleExportPDF, handleExportDOCX } from '@/utils';
import {
  CategoryTitle as PopoverCategoryTitle,
  Divider as PopoverDivider,
} from '@/components/ui/PopoverMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** 与 PopoverMenu.Item 一致的菜单项样式 */
const menuItemClassName = cn(
  'flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm font-medium text-neutral-500 outline-none',
  'hover:bg-neutral-100 hover:text-neutral-800 focus:bg-neutral-100 focus:text-neutral-800',
  'dark:hover:bg-neutral-900 dark:hover:text-neutral-200 dark:focus:bg-neutral-900 dark:focus:text-neutral-200',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
);

/** 与 Surface + Popover 主菜单容器一致：收窄宽度，高度由内容撑开，最高 80vh */
const menuContentClassName = cn(
  'flex w-[12rem] max-w-[85vw] flex-col gap-0.5 overflow-y-auto rounded-xl border border-neutral-100 bg-white p-2 shadow',
  'max-h-[80vh]',
  'dark:border-gray-700 dark:bg-gray-800',
  'z-[9999]',
);

/** 页宽子菜单：与 Surface 一致 */
const subMenuContentClassName = cn(
  'max-h-[80vh] overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-100 bg-white p-0 shadow-lg',
  'dark:border-gray-700 dark:bg-gray-800',
  'z-[9999]',
);

const subMenuTriggerClassName = cn(
  menuItemClassName,
  'w-full pr-1 data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-900',
);

/** 菜单内 Lucide 图标统一尺寸与线宽 */
const menuLucideIconClass = 'h-4 w-4 shrink-0 stroke-[2] text-neutral-500 dark:text-neutral-400';

/** 触发条与左侧浮层之间常有缝隙，略延迟再关，避免移入面板时闪关 */
const PAGE_WIDTH_HOVER_CLOSE_DELAY_MS = 150;

export function DocumentActions({ editor, documentId, documentTitle, doc }: DocumentActionsProps) {
  const router = useRouter();
  const [pageWidthPopoverOpen, setPageWidthPopoverOpen] = useState(false);
  const pageWidthHoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPageWidthHoverCloseTimer = () => {
    if (pageWidthHoverCloseTimerRef.current) {
      clearTimeout(pageWidthHoverCloseTimerRef.current);
      pageWidthHoverCloseTimerRef.current = null;
    }
  };

  const schedulePageWidthPopoverClose = () => {
    clearPageWidthHoverCloseTimer();
    pageWidthHoverCloseTimerRef.current = setTimeout(() => {
      setPageWidthPopoverOpen(false);
      pageWidthHoverCloseTimerRef.current = null;
    }, PAGE_WIDTH_HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    return () => clearPageWidthHoverCloseTimer();
  }, []);

  const { isPanelOpen, togglePanel, comments } = useCommentStore();

  return (
    <>
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => {
          if (!open) {
            clearPageWidthHoverCloseTimer();
            setPageWidthPopoverOpen(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative cursor-pointer rounded-lg p-2 text-gray-600 transition-colors',
              'hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
              'data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-gray-800',
            )}
            aria-label="更多操作"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className={cn(menuContentClassName)}>
          {/* Radix SubContent 在 LTR 下固定向右；用 Popover 才能 side:left */}
          <Popover
            modal={false}
            open={pageWidthPopoverOpen}
            onOpenChange={(open) => {
              clearPageWidthHoverCloseTimer();
              setPageWidthPopoverOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={subMenuTriggerClassName}
                onMouseEnter={() => {
                  clearPageWidthHoverCloseTimer();
                  setPageWidthPopoverOpen(true);
                }}
                onMouseLeave={schedulePageWidthPopoverClose}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <PageWidthMenuIcon />
                  页宽设置
                </span>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="left"
              align="start"
              sideOffset={12}
              collisionPadding={16}
              className={cn(subMenuContentClassName, 'w-auto max-w-[min(92vw,22rem)] p-0')}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onMouseEnter={() => {
                clearPageWidthHoverCloseTimer();
                setPageWidthPopoverOpen(true);
              }}
              onMouseLeave={schedulePageWidthPopoverClose}
            >
              <PageWidthSettingsPanel />
            </PopoverContent>
          </Popover>

          <PopoverCategoryTitle>协作</PopoverCategoryTitle>
          <DropdownMenuItem className={menuItemClassName} onClick={togglePanel}>
            <MessageSquare className={menuLucideIconClass} />
            <span className="flex flex-1 items-center justify-between gap-2">
              <span>{isPanelOpen ? '关闭评论' : '打开评论'}</span>
              {comments.length > 0 && (
                <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {comments.length}
                </span>
              )}
            </span>
          </DropdownMenuItem>

          <PopoverDivider />

          <PopoverCategoryTitle>文档操作</PopoverCategoryTitle>
          {documentId && doc && (
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={() => router.push(`/docs/${documentId}/snapshot`)}
            >
              <History className={menuLucideIconClass} />
              历史记录
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className={menuItemClassName}
            onClick={() => handleExportPDF(documentTitle)}
          >
            <FileType className={menuLucideIconClass} />
            导出PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            className={menuItemClassName}
            onClick={() => handleExportDOCX(documentTitle, editor)}
          >
            <FileText className={menuLucideIconClass} />
            导出Word
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
