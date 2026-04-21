'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Download, Copy, Pencil, Trash2, MoreVertical, Star } from 'lucide-react';

import type { FileItem } from '@/types/file-system';
import { cn } from '@/utils/cn';

interface FileItemMenuProps {
  file: FileItem;
  onShare?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
  onDuplicate?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  /** 收藏 / 取消收藏（仅文件） */
  onStar?: (file: FileItem) => void;
  onMenuOpen?: () => void;
  /** 菜单展开/收起，用于侧栏行高亮 */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const FileItemMenu = ({
  file,
  onShare,
  onDelete,
  onRename,
  onDuplicate,
  onDownload,
  onStar,
  onMenuOpen,
  onOpenChange,
  className,
}: FileItemMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 计算菜单位置
  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // 菜单显示在按钮右侧，垂直居中
      setMenuPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      });
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isOpen) {
      // 打开菜单时触发回调（用于关闭右键菜单等）
      onMenuOpen?.();
      updateMenuPosition();
    }

    setIsOpen(!isOpen);
  };

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const menuItems = [
    {
      icon: Share2,
      label: '分享',
      action: () => onShare?.(file),
      show: !!onShare,
      className: 'text-blue-600 hover:bg-blue-50',
    },
    {
      icon: Download,
      label: '下载',
      action: () => onDownload?.(file),
      show: !!onDownload && file.type === 'file',
      className: 'text-green-600 hover:bg-green-50',
    },
    {
      icon: Copy,
      label: '复制',
      action: () => onDuplicate?.(file),
      show: !!onDuplicate,
      className: 'text-gray-600 hover:bg-gray-50',
    },
    {
      icon: Pencil,
      label: '重命名',
      action: () => onRename?.(file),
      show: !!onRename,
      className: 'text-gray-600 hover:bg-gray-50',
    },
    {
      icon: Star,
      label: file.is_starred ? '取消收藏' : '收藏',
      action: () => onStar?.(file),
      show: !!onStar && file.type === 'file',
      className: file.is_starred
        ? 'text-gray-700 bg-gray-50/90 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
        : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/25',
    },
    {
      icon: Trash2,
      label: '删除',
      action: () => onDelete?.(file),
      show: !!onDelete,
      className: 'text-red-600 hover:bg-red-50',
      divider: true,
    },
  ].filter((item) => item.show);

  // 菜单内容
  const menuContent = isOpen && (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: 'translateY(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={item.label}>
            {item.divider && index > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            )}
            <button
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center transition-colors',
                item.className,
              )}
              onClick={() => handleMenuItemClick(item.action)}
            >
              <Icon
                className={cn(
                  'h-4 w-4 mr-2',
                  item.label === '收藏' && 'fill-amber-400 text-amber-500',
                  item.label === '取消收藏' && 'text-gray-700 dark:text-gray-300',
                )}
              />
              {item.label}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        ref={buttonRef}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        onClick={handleMenuClick}
        onMouseEnter={updateMenuPosition}
        title="更多操作"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* 使用 Portal 渲染菜单到 body */}
      {typeof window !== 'undefined' && createPortal(menuContent, document.body)}
    </div>
  );
};

export default FileItemMenu;
