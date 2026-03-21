'use client';

import { useEffect } from 'react';

import { ChatPanel } from './index';

import { useChatStore, MIN_CHAT_WIDTH } from '@/stores/chatStore';

const MAX_CHAT_WIDTH = 500;

interface ChatPanelContainerProps {
  documentId: string;
}

export function ChatPanelContainer({ documentId }: ChatPanelContainerProps) {
  const { isOpen, width, setWidth, isResizing, setIsResizing } = useChatStore();

  // 拖拽逻辑 - 从右侧计算宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // 从右侧计算: 窗口宽度 - 鼠标X位置
      const newWidth = Math.max(
        MIN_CHAT_WIDTH,
        Math.min(MAX_CHAT_WIDTH, window.innerWidth - e.clientX),
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
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
  }, [isResizing, setWidth]);

  return (
    <div
      className={`absolute top-0 right-0 h-full flex flex-col bg-white dark:bg-[#1a1a1a] border-l border-gray-200 dark:border-gray-800 overflow-hidden ${
        isResizing ? '' : 'transition-all duration-300 ease-in-out'
      }`}
      style={{
        width: isOpen ? `${width}px` : '0px',
        zIndex: 30,
      }}
    >
      {isOpen && (
        <>
          <div className="flex-1 h-full overflow-hidden flex flex-col">
            <ChatPanel documentId={documentId} />
          </div>
          {/* 左侧拖拽条 - 增加可见性和点击区域 */}
          <div
            className="absolute top-0 bottom-0 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors"
            style={{
              zIndex: 100,
              left: '-4px',
              width: '8px',
              backgroundColor: isResizing ? 'rgba(59, 130, 246, 0.5)' : undefined,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
            }}
          />
        </>
      )}
    </div>
  );
}
