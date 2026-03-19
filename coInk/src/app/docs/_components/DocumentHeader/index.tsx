'use client';

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  PanelLeft,
  ChevronDown,
  LogOut,
  User,
  Share2,
  Search,
  Plus,
  MoreHorizontal,
  Bell,
  List,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { UserAvatar } from './components/user-avatar';
import { DocumentActions } from './components/document-actions';
import type { DocumentHeaderProps, CollaborationUser } from './types';
import ShareDialog from '../DocumentSidebar/folder/ShareDialog';

import { useEditorStore } from '@/stores/editorStore';
import { useChatStore } from '@/stores/chatStore';
import { useFileStore } from '@/stores/fileStore';
import { cn } from '@/utils';
import type { FileItem } from '@/types/file-system';

// 格式化相对时间
function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch {
    return '';
  }
}

// 查找文件在分组中的位置
function findFileInGroups(
  groups: { files: FileItem[] }[],
  fileId: string | undefined,
): FileItem | null {
  if (!fileId) return null;
  for (const group of groups) {
    const found = group.files.find((f) => f.id === fileId);
    if (found) return found;
  }
  return null;
}

// 当前用户下拉菜单组件
function CurrentUserMenu({ currentUser }: { currentUser?: CollaborationUser | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!currentUser) return null;

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('cached_user_profile');
    window.location.href = '/login';
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="relative">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
              style={{ backgroundColor: currentUser.color || '#3B82F6' }}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {currentUser.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/profile';
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <User className="w-4 h-4" />
              个人中心
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// 通知铃铛组件
function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: number; title: string; content?: string; isRead: boolean; createdAt: string }[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 模拟获取通知数据 - 实际项目中应该从 API 获取
  // const { data: notificationsData } = useNotificationsQuery({ page: 1, limit: 10 });
  // const { data: unreadCountData } = useUnreadCountQuery();

  // 标记组件已挂载，避免 SSR hydration 错误
  // useEffect(() => {
  //   setMounted(true);
  // }, []);

  // SSR 时渲染占位符
  // if (!mounted) {
  //   return (
  //     <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
  //       <Bell className="w-5 h-5" />
  //     </button>
  //   );
  // }

  const formatTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: zhCN });
    } catch {
      return '刚刚';
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-[400px] overflow-y-auto">
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="font-semibold text-sm">通知中心</span>
              {unreadCount > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {unreadCount} 条未读
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">暂无通知</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  className="w-full flex flex-col items-start p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-b-0"
                  onClick={() => {}}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`font-medium text-sm ${
                        notification.isRead ? 'text-gray-600' : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {notification.title}
                    </span>
                    {!notification.isRead && <div className="h-2 w-2 bg-blue-500 rounded-full" />}
                  </div>
                  {notification.content && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                  )}
                  <span className="text-xs text-gray-400 mt-1">
                    {formatTime(notification.createdAt)}
                  </span>
                </button>
              ))
            )}

            {notifications.length > 0 && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <button className="w-full text-center text-blue-600 text-sm py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  查看所有通知
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DocumentHeader({
  provider,
  connectedUsers = [],
  currentUser,
  documentId,
  documentName = '未命名文档',
  documentTitle,
  doc,
  isSidebarOpen = true,
  toggleSidebar,
  isTocOpen = false,
  toggleToc,
}: DocumentHeaderProps) {
  const pathname = usePathname();
  const isCollaborationMode = Boolean(provider) && Array.isArray(connectedUsers);
  const { editor } = useEditorStore();
  const { isOpen: isChatOpen, togglePanel } = useChatStore();
  const { documentGroups } = useFileStore();

  // 分享对话框状态
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // 获取实际显示的标题
  const displayTitle = documentTitle || documentName || '未命名文档';

  // 获取当前文档信息（包含更新时间）
  const currentFile = useMemo(() => {
    return findFileInGroups(documentGroups, documentId);
  }, [documentGroups, documentId]);

  // 格式化更新时间
  const updatedTimeText = useMemo(() => {
    return formatRelativeTime(currentFile?.updated_at);
  }, [currentFile?.updated_at]);

  // 处理分享按钮点击
  const handleShare = () => {
    setShareDialogOpen(true);
  };

  // 分享对话框的文件数据
  const shareFileItem: FileItem | null = documentId
    ? {
        id: documentId,
        name: displayTitle,
        type: 'file',
        depth: 0,
      }
    : null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700 min-h-[60px] relative z-10">
      {/* 目录切换按钮 */}
      {toggleToc && (
        <button
          type="button"
          onClick={toggleToc}
          className={`p-2 rounded-lg transition-colors ${
            isTocOpen
              ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
          title="文档目录"
          aria-label={isTocOpen ? '关闭目录' : '打开目录'}
        >
          <List className="w-5 h-5" />
        </button>
      )}

      {/* 左侧：侧边栏切换按钮、目录按钮、文档标题和更新时间 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {/* 侧边栏切换按钮 - 仅在侧边栏关闭且有文档ID时显示 */}
          {toggleSidebar && !isSidebarOpen && pathname !== '/docs' && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
              aria-label="显示侧边栏"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 文档标题和更新时间 */}
        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
            {displayTitle}
          </h1>
          {updatedTimeText && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{updatedTimeText}</span>
          )}
        </div>
      </div>

      {/* 右侧：协作用户头像、分享、操作、通知、用户菜单 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 其他协作用户头像（不包含当前用户） */}
        {isCollaborationMode && connectedUsers.length > 0 && (
          <div className="flex items-center -space-x-2 mr-2">
            {connectedUsers.slice(0, 4).map((user, index) => (
              <UserAvatar
                key={user.id}
                user={user}
                currentUser={currentUser}
                index={index}
                total={connectedUsers.length}
              />
            ))}
            {connectedUsers.length > 4 && (
              <div className="w-7 h-7 bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm ml-1">
                +{connectedUsers.length - 4}
              </div>
            )}
          </div>
        )}

        {/* 分享按钮 - 蓝色突出 */}
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>分享</span>
        </button>

        {/* 编辑下拉菜单（包含更多操作） */}
        {editor && (
          <DocumentActions
            editor={editor}
            documentId={documentId}
            documentTitle={displayTitle}
            doc={doc}
            connectedUsers={connectedUsers}
            currentUser={currentUser}
          />
        )}

        {/* 通知铃铛 */}
        <NotificationBell />

        {/* 搜索按钮 */}
        <button
          type="button"
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="搜索"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* 添加按钮 */}
        <button
          type="button"
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="新建"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* 分隔线 */}
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* 当前用户菜单 */}
        <CurrentUserMenu currentUser={currentUser} />
      </div>

      {/* 分享对话框 */}
      {shareFileItem && (
        <ShareDialog
          file={shareFileItem}
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
    </div>
  );
}
