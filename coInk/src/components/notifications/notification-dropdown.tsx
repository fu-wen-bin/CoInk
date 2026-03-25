'use client';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useMarkAsReadMutation,
} from '@/hooks/useNotifications';
import { useAppRealtime } from '@/hooks/useAppRealtime';
import { friendService } from '@/services/friend';
import { permissionRequestsApi } from '@/services/permission-requests';
import {
  getNotificationDocumentId,
  getNotificationDocumentTitle,
  getNotificationTypeLabel,
} from '@/utils/notification';
import { toastError, toastSuccess } from '@/utils/toast';

interface NotificationListItem {
  id: string;
  requestId: string;
  type: string;
  title: string;
  content?: string;
  isRead: boolean;
  createdAt: Date | string;
  status?: string;
}

const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const cached = localStorage.getItem('cached_user_profile');
    const parsed = cached ? (JSON.parse(cached) as { userId?: string }) : null;
    return parsed?.userId ?? '';
  } catch {
    return '';
  }
};

export default function NotificationDropdown() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [processingKey, setProcessingKey] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: notificationsData, isLoading: isLoadingNotifications } = useNotificationsQuery({
    page: 1,
    limit: 10,
  });
  const { data: unreadCountData, isLoading: isLoadingCount } = useUnreadCountQuery();
  const markAsReadMutation = useMarkAsReadMutation();

  const [mounted, setMounted] = useState(false);

  // 标记组件已挂载，避免 SSR hydration 错误
  useEffect(() => {
    setMounted(true);
    setUserId(getCurrentUserId());
  }, []);

  const refreshNotifications = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const syncUnreadCount = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const count = (payload as { unreadCount?: unknown }).unreadCount;
      if (typeof count !== 'number') return;
      queryClient.setQueryData(['notifications', 'unread-count'], { count });
    },
    [queryClient],
  );

  const realtimeHandlers = useMemo(
    () => ({
      'notification.new': (payload: unknown) => {
        syncUnreadCount(payload);
        refreshNotifications();
      },
    }),
    [refreshNotifications, syncUnreadCount],
  );

  useAppRealtime(userId || null, realtimeHandlers);

  const notifications: NotificationListItem[] = (notificationsData?.notifications || []).map(
    (item) => {
      const payload = item.payload ?? {};
      const title = getNotificationTypeLabel(item.type);
      const documentTitle = getNotificationDocumentTitle(payload);
      const documentId = getNotificationDocumentId(payload);

      const content = (() => {
        // 如果有明确的 message，优先使用
        if (typeof payload.message === 'string' && payload.message.trim()) {
          // 权限申请通知，追加权限类型信息
          if (item.type === 'PERMISSION_REQUEST_CREATED' && payload.targetPermission) {
            const permMap: Record<string, string> = {
              view: '查看',
              comment: '评论',
              edit: '编辑',
              manage: '完全管理',
            };
            return `${payload.message} (${permMap[payload.targetPermission as string] || payload.targetPermission}权限)`;
          }
          return payload.message;
        }

        // 好友申请已处理
        if (item.type === 'FRIEND_REQUEST_REVIEWED') {
          return payload.status === 'approved'
            ? '对方已同意你的好友申请'
            : payload.status === 'rejected'
              ? '对方已拒绝你的好友申请'
              : '好友申请状态已更新';
        }

        // 权限申请已处理
        if (item.type === 'PERMISSION_REQUEST_REVIEWED') {
          const permMap: Record<string, string> = {
            view: '查看',
            comment: '评论',
            edit: '编辑',
            manage: '完全管理',
          };
          const permText = payload.targetPermission
            ? `(${permMap[payload.targetPermission as string] || payload.targetPermission}权限) `
            : '';
          return payload.status === 'approved'
            ? `权限申请已通过 ${permText}`
            : payload.status === 'rejected'
              ? `权限申请已拒绝 ${permText}`
              : '权限申请状态已更新';
        }

        // 收到权限申请（没有 message 时）
        if (item.type === 'PERMISSION_REQUEST_CREATED') {
          const permMap: Record<string, string> = {
            view: '查看',
            comment: '评论',
            edit: '编辑',
            manage: '完全管理',
          };
          const permText = payload.targetPermission
            ? permMap[payload.targetPermission as string] || payload.targetPermission
            : '编辑';
          return `申请${permText}权限`;
        }

        // 默认显示文档标题，缺失时显示文档ID
        if (documentTitle) {
          return `文档 ${documentTitle}`;
        }
        if (documentId) {
          return `文档 ${documentId}`;
        }

        return undefined;
      })();

      return {
        id: item.notificationId,
        requestId: item.requestId,
        type: item.type,
        title,
        content,
        isRead: Boolean(item.readAt),
        createdAt: item.createdAt,
        status: typeof payload.status === 'string' ? payload.status : undefined,
      };
    },
  );

  const unreadCount = unreadCountData?.count || 0;

  // SSR 时渲染占位符，避免与客户端生成不同的 Radix UI id
  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="relative hover:bg-gray-100" disabled>
        <Bell className="h-5 w-5 text-gray-600" />
      </Button>
    );
  }

  // 格式化时间
  const formatTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      return formatDistanceToNow(dateObj, { addSuffix: true, locale: zhCN });
    } catch {
      return '刚刚';
    }
  };

  const handleNotificationClick = async (notification: NotificationListItem) => {
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    router.push(
      `/dashboard/inbox?requestId=${encodeURIComponent(notification.requestId)}&type=${encodeURIComponent(notification.type)}`,
    );
  };

  const handleQuickAction = async (
    e: React.MouseEvent,
    notification: NotificationListItem,
    action: 'approve' | 'reject',
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId) {
      toastError('请先登录后再处理申请');
      return;
    }

    const key = `${notification.id}:${action}`;
    setProcessingKey(key);

    try {
      if (notification.type === 'FRIEND_REQUEST_CREATED') {
        const { error } = await friendService.respondFriendRequest(notification.requestId, {
          receiverId: userId,
          action,
        });

        if (error) {
          toastError(error);
          return;
        }
      }

      if (notification.type === 'PERMISSION_REQUEST_CREATED') {
        const { error } = await permissionRequestsApi.review(notification.requestId, {
          reviewerId: userId,
          action,
        });

        if (error) {
          toastError(error);
          return;
        }
      }

      if (!notification.isRead) {
        await markAsReadMutation.mutateAsync(notification.id);
      }

      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toastSuccess(action === 'approve' ? '已同意申请' : '已拒绝申请');
    } finally {
      setProcessingKey('');
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative hover:bg-gray-100 ${isOpen ? 'bg-gray-100' : ''}`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {!isLoadingCount && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex items-center justify-between py-3">
          <span className="font-semibold">通知中心</span>
          {!isLoadingCount && unreadCount > 0 && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
              {unreadCount} 条未读
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {isLoadingNotifications ? (
            // 加载骨架屏
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-full"></div>
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4"></div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            // 空状态
            <div className="p-8 text-center text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">暂无通知</p>
            </div>
          ) : (
            // 通知列表
            notifications.map((notification) => {
              const canQuickReview =
                notification.type === 'FRIEND_REQUEST_CREATED' ||
                notification.type === 'PERMISSION_REQUEST_CREATED';
              const isPending = !notification.status || notification.status === 'pending';

              return (
                <div
                  key={notification.id}
                  className="flex flex-col items-start space-y-2 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => void handleNotificationClick(notification)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`font-medium text-sm ${
                        notification.isRead ? 'text-gray-600' : 'text-gray-900'
                      }`}
                    >
                      {notification.title}
                    </span>
                    {!notification.isRead && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                  {notification.content && (
                    <p className="text-xs text-gray-600 leading-relaxed w-full">
                      {notification.content}
                    </p>
                  )}
                  {canQuickReview && isPending && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        className="h-7 rounded-md bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                        onClick={(e) => void handleQuickAction(e, notification, 'approve')}
                        disabled={processingKey === `${notification.id}:approve`}
                      >
                        同意
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded-md bg-gray-200 px-2.5 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-60"
                        onClick={(e) => void handleQuickAction(e, notification, 'reject')}
                        disabled={processingKey === `${notification.id}:reject`}
                      >
                        拒绝
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded-md border border-blue-200 px-2.5 text-xs text-blue-600 hover:bg-blue-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleNotificationClick(notification);
                        }}
                      >
                        查看详情
                      </button>
                    </div>
                  )}
                  {canQuickReview && !isPending && (
                    <span className="text-xs text-gray-500">该申请已处理</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatTime(notification.createdAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {!isLoadingNotifications && notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="w-full text-center text-blue-600 font-medium hover:bg-blue-50 py-3 text-sm"
              onClick={() => router.push('/dashboard/inbox')}
            >
              查看全部通知
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
