'use client';

import { useEffect, useState, useRef } from 'react';

// 导入各个tab组件
import SidebarContent from './SidebarContent';

import { useSidebar } from '@/stores/sidebarStore';

const MIN_WIDTH = 260;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;
const TOGGLE_THRESHOLD = 200;

function DocumentSidebar() {
  const { isOpen } = useSidebar();

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  // 拖拽调整宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = clamp(e.clientX, MIN_WIDTH, MAX_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsResizing(false);

      if (e.clientX < TOGGLE_THRESHOLD && isOpen) {
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div
      ref={sidebarRef}
      className="flex h-full relative bg-white dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden"
      style={{ width: isOpen ? `${sidebarWidth}px` : '0px' }}
    >
      {/* 右侧内容区域 */}
      {isOpen && (
        <>
          <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-left duration-200">
            <SidebarContent />
          </div>

          {/* 右侧拖拽调整条 */}
          <div
            className="absolute -right-1.5 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors z-50"
            onMouseDown={() => setIsResizing(true)}
          />
        </>
      )}
    </div>
  );
}

export default DocumentSidebar;
