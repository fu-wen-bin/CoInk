'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PanelLeft, ChevronDown, LogOut, User, Share2, Search, Plus, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { UserAvatar } from './components/user-avatar';
import { DocumentActions } from './components/document-actions';
import type { DocumentHeaderProps, CollaborationUser } from './types';
import ShareDialog from '../DocumentSidebar/folder/ShareDialog';

import { useEditorStore } from '@/stores/editorStore';
import { useFileStore } from '@/stores/fileStore';
import { cn, formatDocumentLastModified } from '@/utils';
import type { FileItem } from '@/types/file-system';
import { documentsApi } from '@/services/documents';

function findFileInTree(items: FileItem[], fileId: string): FileItem | null {
  for (const item of items) {
    if (item.id === fileId) return item;
    if (item.children?.length) {
      const nested = findFileInTree(item.children, fileId);
      if (nested) return nested;
    }
  }
  return null;
}

/** 在侧边栏分组中递归查找文件（含嵌套文件夹） */
function findFileInGroups(
  groups: { files: FileItem[] }[],
  fileId: string | undefined,
): FileItem | null {
  if (!fileId) return null;
  for (const group of groups) {
    const found = findFileInTree(group.files, fileId);
    if (found) return found;
  }
  return null;
}

// 当前用户下拉菜单组件
function CurrentUserMenu({ currentUser }: { currentUser?: CollaborationUser | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

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
                setIsOpen(false);
                router.push('/dashboard');
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
  const [isOpen, setIsOpen] = useState(false);
  const [notifications] = useState<
    { id: number; title: string; content?: string; isRead: boolean; createdAt: string }[]
  >([]);
  const [unreadCount] = useState(0);

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
}: DocumentHeaderProps) {
  const pathname = usePathname();
  const isCollaborationMode = Boolean(provider) && Array.isArray(connectedUsers);
  const { editor, setIsHeaderHovered, setHistoryPanelOpen } = useEditorStore();
  const { documentGroups } = useFileStore();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  /** 侧边栏未包含当前文档时，用 GET /documents/:id 的 updatedAt 作为「最近修改」来源 */
  const [fetchedUpdatedAt, setFetchedUpdatedAt] = useState<string | null>(null);
  /** 每分钟刷新一次相对时间文案（刚刚 / N 分钟前） */
  const [lastModifiedTick, setLastModifiedTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setLastModifiedTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const displayTitle = documentTitle || documentName || '未命名文档';

  const currentFile = useMemo(() => {
    return findFileInGroups(documentGroups, documentId);
  }, [documentGroups, documentId]);

  useEffect(() => {
    if (!documentId) {
      setFetchedUpdatedAt(null);
      return;
    }
    if (currentFile?.updated_at) {
      setFetchedUpdatedAt(null);
      return;
    }
    let cancelled = false;
    documentsApi.getById(documentId).then(({ data, error }) => {
      if (cancelled || error || !data?.data) return;
      setFetchedUpdatedAt(data.data.updatedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId, currentFile?.updated_at]);

  const updatedAtSource = currentFile?.updated_at ?? fetchedUpdatedAt ?? undefined;

  const lastModifiedDisplay = useMemo(() => {
    return updatedAtSource ? formatDocumentLastModified(updatedAtSource) : '';
  }, [updatedAtSource, lastModifiedTick]);

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const shareFileItem: FileItem | null = documentId
    ? {
        id: documentId,
        name: displayTitle,
        type: 'file',
        depth: 0,
      }
    : null;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700 min-h-[60px] relative z-10"
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
    >
      {/* 左侧：侧边栏切换按钮、文档标题和更新时间 */}
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

        {/* 文档标题和最近修改（点击打开文档历史，时间来自后端 updatedAt） */}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-base font-semibold leading-tight text-gray-900 dark:text-gray-100">
            {displayTitle}
          </h1>
          {documentId && lastModifiedDisplay && (
            <button
              type="button"
              disabled={!doc}
              onClick={() => doc && setHistoryPanelOpen(true)}
              className={cn(
                'mt-0.5 block max-w-full truncate text-left text-xs text-gray-400 dark:text-gray-500',
                doc && 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-400',
                !doc && 'cursor-not-allowed opacity-60',
              )}
            >
              最近修改：{lastModifiedDisplay}
            </button>
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
