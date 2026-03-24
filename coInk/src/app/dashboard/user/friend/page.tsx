'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { friendService } from '@/services/friend';
import type { Friend, FriendRequestItem } from '@/services/friend/types';
import { toastError, toastSuccess } from '@/utils/toast';
import { useAppRealtime } from '@/hooks/useAppRealtime';

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

export default function FriendPage() {
  const [userId, setUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">添加好友</h2>
        <p className="mt-1 text-sm text-gray-500">输入对方 userId 发送申请</p>

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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">收到的申请</h3>
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
            {!loading && friends.length === 0 && <p className="text-sm text-gray-500">暂无好友</p>}
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

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">我发出的申请</h3>
        <div className="mt-4 space-y-3">
          {outgoing.length === 0 && <p className="text-sm text-gray-500">暂无发出的申请</p>}
          {outgoing.map((item) => (
            <div key={item.requestId} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-700">发送给：{item.receiverId}</p>
              <p className="mt-1 text-xs text-gray-500">状态：{item.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
