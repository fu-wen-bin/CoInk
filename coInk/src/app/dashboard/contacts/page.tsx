'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useMarkAsReadMutation,
} from '@/hooks/useNotifications';
import { useAppRealtime } from '@/hooks/useAppRealtime';
import { friendService } from '@/services/friend';
import type { Friend, FriendRequestItem, FriendSearchItem } from '@/services/friend/types';
import { permissionRequestsApi } from '@/services/permission-requests';
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

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [processingKey, setProcessingKey] = useState('');

  const { data: notificationsData } = useNotificationsQuery({ page: 1, limit: 20 });
  const { data: unreadCountData } = useUnreadCountQuery();
  const markAsReadMutation = useMarkAsReadMutation();

  const refresh = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const [friendsRes, requestsRes] = await Promise.all([
      friendService.getFriendList(userId),
      friendService.getFriendRequests(userId),
    ]);
    setLoading(false);

    if (friendsRes.error) {
      toastError(friendsRes.error);
      return;
    }

    if (requestsRes.error) {
      toastError(requestsRes.error);
      return;
    }

    setFriends(friendsRes.data?.data ?? []);
    setIncoming(requestsRes.data?.data?.incoming ?? []);
    setOutgoing(requestsRes.data?.data?.outgoing ?? []);
  }, [userId]);

  useEffect(() => {
    setUserId(getCurrentUserId());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handlers = useMemo(
    () => ({
      'friend.request.created': () => {
        void refresh();
      },
      'friend.request.reviewed': () => {
        void refresh();
      },
      'notification.new': () => {
        void refresh();
      },
    }),
    [refresh],
  );

  useAppRealtime(userId || null, handlers);

  const notifications: NotificationDetailItem[] = (notificationsData?.notifications || []).map(
    (item) => {
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      const title =
        item.type === 'PERMISSION_REQUEST_CREATED'
          ? '收到权限申请'
          : item.type === 'PERMISSION_REQUEST_REVIEWED'
            ? '权限申请已处理'
            : item.type === 'FRIEND_REQUEST_CREATED'
              ? '收到好友申请'
              : item.type === 'FRIEND_REQUEST_REVIEWED'
                ? '好友申请已处理'
                : '系统通知';

      const content =
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : item.type === 'FRIEND_REQUEST_REVIEWED' || item.type === 'PERMISSION_REQUEST_REVIEWED'
            ? `处理结果：${formatRequestStatus(payload.status)}`
            : typeof payload.documentId === 'string'
              ? `文档 ${payload.documentId}`
              : undefined;

      return {
        id: item.notificationId,
        requestId: item.requestId,
        type: item.type,
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

  const selectedNotification = useMemo(() => {
    if (!selectedRequestId) return null;

    return (
      notifications.find(
        (item) =>
          item.requestId === selectedRequestId && (!selectedType || item.type === selectedType),
      ) || null
    );
  }, [notifications, selectedRequestId, selectedType]);

  const onSendRequest = async () => {
    if (!userId) {
      toastError('请先登录');
      return;
    }
    if (!targetUserId.trim()) {
      toastError('请输入目标用户 ID');
      return;
    }

    setSending(true);
    const { error } = await friendService.sendFriendRequest({
      requesterId: userId,
      receiverId: targetUserId.trim(),
      message: '你好，想加你为好友。',
    });
    setSending(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess('好友申请已发送');
    setTargetUserId('');
    void refresh();
  };

  const onRespond = async (requestId: string, action: 'approve' | 'reject') => {
    if (!userId) return;

    const { error } = await friendService.respondFriendRequest(requestId, {
      receiverId: userId,
      action,
    });

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess(action === 'approve' ? '已通过好友申请' : '已拒绝好友申请');
    void refresh();
  };

  const onSearch = async () => {
    if (!userId) return;
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const { data, error } = await friendService.searchUsers(userId, searchKeyword.trim());
    setSearching(false);

    if (error) {
      toastError(error);
      return;
    }

    setSearchResults(data?.data ?? []);
  };

  const onQuickSendRequest = async (targetId: string) => {
    if (!userId) return;
    const { error } = await friendService.sendFriendRequest({
      requesterId: userId,
      receiverId: targetId,
      message: '你好，想加你为好友。',
    });

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess('好友申请已发送');
    void refresh();
    setSearchResults((prev) => prev.filter((item) => item.userId !== targetId));
  };

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
      router.replace('/dashboard/contacts');
      void refresh();
    } finally {
      setProcessingKey('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">通讯录</h2>
            <p className="mt-1 text-sm text-gray-500">在这里管理好友、添加联系人，并查看通知详情</p>
          </div>
          <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
            通知未读 {unreadCountData?.count ?? 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">添加好友</h3>
            <p className="mt-1 text-sm text-gray-500">
              支持直接输入 userId，或先搜索用户再发送申请
            </p>

            <div className="mt-4 flex gap-3">
              <input
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="例如: user_xxx"
                className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={onSendRequest}
                disabled={sending}
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sending ? '发送中...' : '发送申请'}
              </button>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex gap-3">
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索用户名 / 邮箱 / userId"
                  className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => void onSearch()}
                  disabled={searching}
                  className="h-10 rounded-lg border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {searching ? '搜索中...' : '搜索'}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {searchResults.map((item) => (
                  <div
                    key={item.userId}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.userId}</p>
                      {item.email ? <p className="text-xs text-gray-400">{item.email}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onQuickSendRequest(item.userId)}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                    >
                      添加好友
                    </button>
                  </div>
                ))}
                {!searching && searchKeyword.trim() && searchResults.length === 0 ? (
                  <p className="text-xs text-gray-500">未找到可添加的用户</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">收到的好友申请</h3>
              <div className="mt-4 space-y-3">
                {incoming.length === 0 && <p className="text-sm text-gray-500">暂无收到的申请</p>}
                {incoming.map((item) => (
                  <div key={item.requestId} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm text-gray-700">来自：{item.requesterId}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.message || '无附言'}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                        onClick={() => onRespond(item.requestId, 'approve')}
                        disabled={item.status !== 'pending'}
                      >
                        同意
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-300"
                        onClick={() => onRespond(item.requestId, 'reject')}
                        disabled={item.status !== 'pending'}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">我的好友</h3>
              <div className="mt-4 space-y-3">
                {loading && <p className="text-sm text-gray-500">加载中...</p>}
                {!loading && friends.length === 0 && (
                  <p className="text-sm text-gray-500">暂无好友</p>
                )}
                {friends.map((f) => (
                  <div
                    key={f.userId}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-500">{f.userId}</p>
                    </div>
                    <span className="text-xs text-gray-400">好友</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
          <h3 className="text-base font-semibold text-gray-900">通知详情</h3>
          {!selectedNotification ? (
            <p className="mt-3 text-sm text-gray-500">
              从右上角铃铛进入通知后，可跳转到此处查看具体详情与处理操作。
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900">{selectedNotification.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  请求号：{selectedNotification.requestId}
                </p>
                <p className="mt-1 text-xs text-gray-500">类型：{selectedNotification.type}</p>
                {selectedNotification.content ? (
                  <p className="mt-2 text-sm text-gray-700">{selectedNotification.content}</p>
                ) : null}
              </div>

              {(selectedNotification.type === 'FRIEND_REQUEST_CREATED' ||
                selectedNotification.type === 'PERMISSION_REQUEST_CREATED') && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-8 rounded-md bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                    onClick={() => void handleNotificationQuickAction('approve')}
                    disabled={processingKey === `${selectedNotification.id}:approve`}
                  >
                    同意
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-md bg-gray-200 px-3 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-60"
                    onClick={() => void handleNotificationQuickAction('reject')}
                    disabled={processingKey === `${selectedNotification.id}:reject`}
                  >
                    拒绝
                  </button>
                </div>
              )}

              {typeof selectedNotification.payload.documentId === 'string' ? (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => router.push(`/docs/${selectedNotification.payload.documentId}`)}
                >
                  打开相关文档
                </button>
              ) : null}
            </div>
          )}

          <div className="mt-6 border-t border-gray-100 pt-4">
            <h4 className="text-sm font-semibold text-gray-900">最近通知</h4>
            <div className="mt-2 space-y-2">
              {notifications.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                  onClick={() =>
                    router.push(
                      `/dashboard/contacts?requestId=${encodeURIComponent(item.requestId)}&type=${encodeURIComponent(item.type)}`,
                    )
                  }
                >
                  <p className="text-xs font-medium text-gray-800">{item.title}</p>
                  {item.content ? (
                    <p className="text-xs text-gray-500 mt-1">{item.content}</p>
                  ) : null}
                </button>
              ))}
              {notifications.length === 0 && <p className="text-xs text-gray-500">暂无通知</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">我发出的好友申请</h3>
        <div className="mt-4 space-y-3">
          {outgoing.length === 0 && <p className="text-sm text-gray-500">暂无发出的申请</p>}
          {outgoing.map((item) => (
            <div key={item.requestId} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-700">发送给：{item.receiverId}</p>
              <p className="mt-1 text-xs text-gray-500">状态：{formatRequestStatus(item.status)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
