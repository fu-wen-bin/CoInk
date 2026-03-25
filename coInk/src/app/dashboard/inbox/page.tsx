'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('cached_user_profile');
    const parsed = raw ? (JSON.parse(raw) as { userId?: string }) : null;
    return parsed?.userId ?? '';
  } catch {
    return '';
  }
};

interface NotificationDetailItem {
  id: string;
  requestId: string;
  type: string;
  typeLabel: string;
  title: string;
  content?: string;
  isRead: boolean;
  createdAt: Date | string;
  payload: Record<string, unknown>;
}

const formatRequestStatus = (status?: unknown): string => {
  if (status === 'pending') return '待处理';
  if (status === 'approved') return '已同意';
  if (status === 'rejected') return '已拒绝';
  if (status === 'cancelled') return '已取消';
  return '未知状态';
};

function InboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState('');
  const [processingKey, setProcessingKey] = useState('');

  const { data: notificationsData } = useNotificationsQuery({ page: 1, limit: 50 });
  const { data: unreadCountData } = useUnreadCountQuery();
  const markAsReadMutation = useMarkAsReadMutation();

  useEffect(() => {
    setUserId(getCurrentUserId());
  }, []);

  const handlers = useMemo(
    () => ({
      'notification.new': (payload: unknown) => {
        if (payload && typeof payload === 'object') {
          const count = (payload as { unreadCount?: unknown }).unreadCount;
          if (typeof count === 'number') {
            queryClient.setQueryData(['notifications', 'unread-count'], { count });
          }
        }
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      },
    }),
    [queryClient],
  );

  useAppRealtime(userId || null, handlers);

  const notifications: NotificationDetailItem[] = (notificationsData?.notifications || []).map(
    (item) => {
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      const title = getNotificationTypeLabel(item.type);
      const documentTitle = getNotificationDocumentTitle(payload);
      const documentId = getNotificationDocumentId(payload);

      const content =
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : item.type === 'FRIEND_REQUEST_REVIEWED' || item.type === 'PERMISSION_REQUEST_REVIEWED'
            ? `处理结果：${formatRequestStatus(payload.status)}`
            : documentTitle
              ? `文档 ${documentTitle}`
              : documentId
                ? `文档 ${documentId}`
                : undefined;

      return {
        id: item.notificationId,
        requestId: item.requestId,
        type: item.type,
        typeLabel: getNotificationTypeLabel(item.type),
        title,
        content,
        isRead: Boolean(item.readAt),
        createdAt: item.createdAt,
        payload,
      };
    },
  );

  const selectedRequestId = searchParams.get('requestId') || '';
  const selectedType = searchParams.get('type') || '';
  // 如果没有选中，默认选第一个
  const effectiveSelectedRequestId =
    selectedRequestId || (notifications.length > 0 ? notifications[0].requestId : '');

  const selectedNotification = useMemo(() => {
    if (!effectiveSelectedRequestId) return null;
    return (
      notifications.find(
        (item) =>
          item.requestId === effectiveSelectedRequestId &&
          (!selectedType || item.type === selectedType),
      ) ||
      notifications[0] ||
      null
    );
  }, [notifications, effectiveSelectedRequestId, selectedType]);

  const handleNotificationQuickAction = async (action: 'approve' | 'reject') => {
    if (!userId || !selectedNotification) return;

    const key = `${selectedNotification.id}:${action}`;
    setProcessingKey(key);

    try {
      if (selectedNotification.type === 'FRIEND_REQUEST_CREATED') {
        const { error } = await friendService.respondFriendRequest(selectedNotification.requestId, {
          receiverId: userId,
          action,
        });
        if (error) {
          toastError(error);
          return;
        }
      }

      if (selectedNotification.type === 'PERMISSION_REQUEST_CREATED') {
        const { error } = await permissionRequestsApi.review(selectedNotification.requestId, {
          reviewerId: userId,
          action,
        });
        if (error) {
          toastError(error);
          return;
        }
      }

      if (!selectedNotification.isRead) {
        await markAsReadMutation.mutateAsync(selectedNotification.id);
      }

      toastSuccess(action === 'approve' ? '已同意申请' : '已拒绝申请');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } finally {
      setProcessingKey('');
    }
  };

  const handleSelect = (item: NotificationDetailItem) => {
    // mark as read when clicking
    if (!item.isRead) {
      markAsReadMutation.mutate(item.id);
    }
    router.push(
      `/dashboard/inbox?requestId=${encodeURIComponent(item.requestId)}&type=${encodeURIComponent(item.type)}`,
    );
  };

  // 如果没有任何选中且有列表，默认选中第一个并跳转（为了URL一致性）
  useEffect(() => {
    if (!selectedRequestId && notifications.length > 0) {
      // Do not automatically mark read on implicit selection, just show UI
      // But update URL? Maybe not to spam history.
    }
  }, [selectedRequestId, notifications.length]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      <div className="w-1/3 min-w-[300px] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">通知列表</h3>
          <span className="text-xs text-gray-500">未读 {unreadCountData?.count ?? 0}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">暂无通知</div>
          )}
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`cursor-pointer border-b border-gray-50 p-4 hover:bg-gray-50 transition-colors ${
                selectedNotification?.id === item.id ? 'bg-blue-50/60' : ''
              } ${!item.isRead ? 'bg-blue-50/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`text-sm font-medium ${!item.isRead ? 'text-blue-700' : 'text-gray-900'}`}
                >
                  {item.title}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
              {item.content && <p className="text-xs text-gray-600 line-clamp-2">{item.content}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {!selectedNotification ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            选择一条通知查看详情
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedNotification.title}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {formatDistanceToNow(new Date(selectedNotification.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
                <span>类型: {selectedNotification.typeLabel}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              {selectedNotification.content ? (
                <p className="text-gray-800 whitespace-pre-wrap">{selectedNotification.content}</p>
              ) : (
                <p className="text-gray-400 italic">无详细内容</p>
              )}

              {/* Remove request ID display as per user request */}
            </div>

            <div className="flex flex-wrap gap-3">
              {(selectedNotification.type === 'FRIEND_REQUEST_CREATED' ||
                selectedNotification.type === 'PERMISSION_REQUEST_CREATED') &&
                (!selectedNotification.payload.status ||
                  selectedNotification.payload.status === 'pending') && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="h-9 px-4 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm"
                      onClick={() => void handleNotificationQuickAction('approve')}
                      disabled={processingKey === `${selectedNotification.id}:approve`}
                    >
                      同意申请
                    </button>
                    <button
                      type="button"
                      className="h-9 px-4 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors shadow-sm"
                      onClick={() => void handleNotificationQuickAction('reject')}
                      disabled={processingKey === `${selectedNotification.id}:reject`}
                    >
                      拒绝申请
                    </button>
                  </div>
                )}

              {(selectedNotification.type === 'FRIEND_REQUEST_CREATED' ||
                selectedNotification.type === 'PERMISSION_REQUEST_CREATED') &&
                typeof selectedNotification.payload.status === 'string' &&
                selectedNotification.payload.status !== 'pending' && (
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm">
                    已处理：{formatRequestStatus(selectedNotification.payload.status)}
                  </div>
                )}

              {typeof selectedNotification.payload.documentId === 'string' ? (
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
                  onClick={() => router.push(`/docs/${selectedNotification.payload.documentId}`)}
                >
                  打开相关文档
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-sm text-gray-500">
          消息加载中...
        </div>
      }
    >
      <InboxPageContent />
    </Suspense>
  );
}
