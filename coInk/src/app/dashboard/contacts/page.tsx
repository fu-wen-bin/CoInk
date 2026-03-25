'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  UserPlus,
  UserCheck,
  CheckCircle,
  XCircle,
  MoreVertical,
  Mail,
} from 'lucide-react';

import { useAppRealtime } from '@/hooks/useAppRealtime';
import { friendService } from '@/services/friend';
import type { Friend, FriendRequestItem, FriendSearchItem } from '@/services/friend/types';
import { UserApi } from '@/services/users';
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

const formatRequestStatus = (status?: unknown): string => {
  if (status === 'pending') return '待处理';
  if (status === 'approved') return '已同意';
  if (status === 'rejected') return '已拒绝';
  if (status === 'cancelled') return '已取消';
  return '未知状态';
};

export default function ContactsPage() {
  const [userId, setUserId] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [requestUserMeta, setRequestUserMeta] = useState<
    Record<string, { name: string; avatarUrl?: string | null }>
  >({});

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRequestMetaIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setUserId(getCurrentUserId());
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;

    const [friendsRes, requestsRes] = await Promise.all([
      friendService.getFriendList(userId),
      friendService.getFriendRequests(userId),
    ]);

    if (friendsRes.error) toastError(friendsRes.error);
    if (requestsRes.error) toastError(requestsRes.error);

    setFriends(friendsRes.data?.data ?? []);
    setIncoming(requestsRes.data?.data?.incoming ?? []);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Fetch meta for incoming requests
  useEffect(() => {
    const ids = new Set<string>();
    incoming.forEach((item) => ids.add(item.requesterId));
    const targetIds = Array.from(ids).filter(
      (id) => id && !fetchedRequestMetaIdsRef.current.has(id),
    );
    if (targetIds.length === 0) return;

    targetIds.forEach((id) => fetchedRequestMetaIdsRef.current.add(id));

    let cancelled = false;
    void Promise.all(
      targetIds.map(async (id) => {
        const res = await UserApi.getUserInfo({ userId: id });
        const user = res.data?.data?.user;
        if (!user) return null;
        return { id, name: user.name || id, avatarUrl: user.avatarUrl ?? null };
      }),
    ).then((items) => {
      if (cancelled) return;
      setRequestUserMeta((prev) => {
        const next = { ...prev };
        for (const item of items) {
          if (!item) continue;
          next[item.id] = { name: item.name, avatarUrl: item.avatarUrl };
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [incoming]);

  // Realtime handlers
  const handlers = useMemo(
    () => ({
      'friend.request.created': () => void refresh(),
      'friend.request.reviewed': () => void refresh(),
      'friend.removed': () => void refresh(),
    }),
    [refresh],
  );

  useAppRealtime(userId || null, handlers);

  // Search logic
  const onSearch = useCallback(async () => {
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
  }, [searchKeyword, userId]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => void onSearch(), 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [onSearch, searchKeyword]);

  const onAddFriend = async (targetId: string) => {
    if (!userId) return;
    const { error } = await friendService.sendFriendRequest({
      requesterId: userId,
      receiverId: targetId,
      message: '你好，我是 ' + (requestUserMeta[userId]?.name || userId),
    });

    if (error) {
      toastError(error);
      return;
    }
    toastSuccess('好友申请已发送');
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
    toastSuccess(action === 'approve' ? '已添加好友' : '已拒绝申请');
    void refresh();
  };

  const isFriend = (targetId: string) => friends.some((f) => f.userId === targetId);
  const isSelf = (targetId: string) => targetId === userId;

  return (
    <div className="flex h-full flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 顶部搜索栏 */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">通讯录</h1>
          <span className="text-xs text-gray-500">好友 {friends.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索好友 / 用户 ID / 邮箱"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>

        {/* 搜索结果展示区 */}
        {searchKeyword.trim() && (
          <div className="absolute left-0 right-0 top-full mt-1 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl p-2 z-20 mx-4 animate-in fade-in zoom-in-95 duration-200">
            {searching ? (
              <div className="flex items-center justify-center p-8 text-gray-400">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-2"></div>
                <span className="text-sm">搜索中...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((user) => {
                  const alreadyFriend = isFriend(user.userId);
                  const self = isSelf(user.userId);
                  return (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover border border-gray-100"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm border border-blue-200">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email || user.userId}</p>
                        </div>
                      </div>
                      <div>
                        {self ? (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            你自己
                          </span>
                        ) : alreadyFriend ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded border border-green-100">
                            <UserCheck className="w-3 h-3" /> 已是好友
                          </span>
                        ) : (
                          <button
                            onClick={() => onAddFriend(user.userId)}
                            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-sm active:scale-95 transform"
                          >
                            <UserPlus className="w-3 h-3" /> 添加好友
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-gray-500">
                <p>未找到相关用户</p>
                <p className="text-xs mt-1 text-gray-400">请尝试输入完整的 ID 或邮箱</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 主要内容区域: 好友列表和好友申请 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
        {/* 好友申请 */}
        {incoming.length > 0 && (
          <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              新的好友申请
            </h3>
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {incoming.map((req) => (
                <div
                  key={req.requestId}
                  className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {requestUserMeta[req.requesterId]?.avatarUrl ? (
                      <img
                        src={requestUserMeta[req.requesterId].avatarUrl || ''}
                        className="w-9 h-9 rounded-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                        {(requestUserMeta[req.requesterId]?.name || req.requesterId)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 truncate">
                      <p
                        className="text-sm font-medium text-gray-900 truncate"
                        title={requestUserMeta[req.requesterId]?.name || req.requesterId}
                      >
                        {requestUserMeta[req.requesterId]?.name || req.requesterId}
                      </p>
                      <p
                        className="text-xs text-gray-500 truncate"
                        title={req.message || '请求添加你为好友'}
                      >
                        {req.message || '请求添加你为好友'}
                      </p>
                    </div>
                  </div>
                  {req.status === 'pending' ? (
                    <div className="flex gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => onRespond(req.requestId, 'approve')}
                        className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors"
                        title="同意"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onRespond(req.requestId, 'reject')}
                        className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors"
                        title="拒绝"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatRequestStatus(req.status)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 好友列表 */}
        <div className="space-y-3">
          {friends.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
              <UserPlus className="w-16 h-16 mb-4 text-gray-100" />
              <p className="text-gray-500 font-medium">暂无好友</p>
              <p className="text-sm mt-2 text-gray-400">在上方搜索框输入用户名或 ID 添加好友</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {friends.map((friend) => (
                <div
                  key={friend.userId}
                  className="group relative flex items-center p-4 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl transition-all hover:shadow-md hover:border-blue-100"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.name}
                        className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 font-bold text-lg shrink-0 border-2 border-white shadow-sm">
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-semibold text-gray-900 truncate text-sm mb-0.5"
                        title={friend.name}
                      >
                        {friend.name}
                      </p>
                      <p
                        className="text-xs text-gray-500 truncate font-mono"
                        title={friend.email || friend.userId}
                      >
                        {friend.email || friend.userId}
                      </p>
                    </div>
                  </div>

                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-1">
                    <button
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="发送消息"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      title="更多操作"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
