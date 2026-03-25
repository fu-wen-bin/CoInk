'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Edit2, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react';

import { friendService } from '@/services/friend';
import type { Friend } from '@/services/friend/types';
import { groupsApi } from '@/services/groups';
import type { Group, GroupMember } from '@/services/groups/types';
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

export default function GroupsPage() {
  const [userId, setUserId] = useState('');
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [createName, setCreateName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [friendKeyword, setFriendKeyword] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    setUserId(getCurrentUserId());
  }, []);

  const loadBaseData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [ownedRes, joinedRes, friendRes] = await Promise.all([
      groupsApi.getOwnedGroups(userId),
      groupsApi.getMyGroups(userId),
      friendService.getFriendList(userId),
    ]);
    setLoading(false);

    if (ownedRes.error) toastError(ownedRes.error);
    if (joinedRes.error) toastError(joinedRes.error);
    if (friendRes.error) toastError(friendRes.error);

    setOwnedGroups(ownedRes.data?.data?.groups ?? []);
    setJoinedGroups(joinedRes.data?.data?.groups ?? []);
    setFriends(friendRes.data?.data ?? []);
  }, [userId]);

  const loadMembers = useCallback(async () => {
    if (!selectedGroup) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    const res = await groupsApi.getGroupMembers(selectedGroup.groupId);
    setMembersLoading(false);
    if (res.error) {
      toastError(res.error);
      return;
    }
    setMembers(res.data?.data?.members ?? []);
  }, [selectedGroup]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const createGroup = async () => {
    const name = createName.trim();
    if (!name) return;
    const res = await groupsApi.createGroup({ name, ownerId: userId });
    if (res.error) {
      toastError(res.error);
      return;
    }
    toastSuccess('分组已创建');
    setCreateName('');
    void loadBaseData();
  };

  const renameGroup = async (groupId: string) => {
    const name = editName.trim();
    if (!name) return;
    const res = await groupsApi.updateGroup(groupId, { name, userId });
    if (res.error) {
      toastError(res.error);
      return;
    }
    toastSuccess('分组已重命名');
    setEditingGroupId(null);
    setEditName('');
    void loadBaseData();
    if (selectedGroup?.groupId === groupId) {
      setSelectedGroup((prev) => (prev ? { ...prev, name } : prev));
    }
  };

  const removeGroup = async (groupId: string) => {
    if (!window.confirm('确定删除该分组吗？')) return;
    const res = await groupsApi.deleteGroup(groupId, userId);
    if (res.error) {
      toastError(res.error);
      return;
    }
    toastSuccess('分组已删除');
    if (selectedGroup?.groupId === groupId) {
      setSelectedGroup(null);
    }
    void loadBaseData();
  };

  const addMember = async (targetUserId: string) => {
    if (!selectedGroup) return;
    setAddingMember(true);
    const res = await groupsApi.addMember(selectedGroup.groupId, { targetUserId, userId });
    setAddingMember(false);
    if (res.error) {
      toastError(res.error);
      return;
    }
    toastSuccess('成员已添加');
    void loadMembers();
    void loadBaseData();
  };

  const removeMember = async (targetUserId: string) => {
    if (!selectedGroup || !window.confirm('确定移除该成员吗？')) return;
    const res = await groupsApi.removeMember(selectedGroup.groupId, targetUserId, userId);
    if (res.error) {
      toastError(res.error);
      return;
    }
    toastSuccess('成员已移除');
    void loadMembers();
    void loadBaseData();
  };

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const searchableFriends = useMemo(() => {
    const q = friendKeyword.trim().toLowerCase();
    return friends.filter((f) => {
      if (memberIds.has(f.userId)) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.userId.toLowerCase().includes(q) ||
        (f.email ? f.email.toLowerCase().includes(q) : false)
      );
    });
  }, [friendKeyword, friends, memberIds]);

  const isOwner = selectedGroup?.ownerId === userId;

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">分组</h2>
        <p className="mt-1 text-sm text-gray-500">按分组管理成员与权限协作</p>

        <div className="mt-4 flex gap-2">
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="输入分组名称"
            className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => void createGroup()}
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> 新建
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">我管理的分组</p>
            <div className="space-y-2">
              {ownedGroups.map((group) => (
                <div
                  key={group.groupId}
                  className={`rounded-lg border p-3 ${selectedGroup?.groupId === group.groupId ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                >
                  {editingGroupId === group.groupId ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void renameGroup(group.groupId)}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(group)}
                        className="min-w-0 text-left"
                      >
                        <p className="truncate text-sm font-medium text-gray-800">{group.name}</p>
                        <p className="text-xs text-gray-500">{group.memberCount ?? 0} 成员</p>
                      </button>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroupId(group.groupId);
                            setEditName(group.name);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          title="重命名"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeGroup(group.groupId)}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!loading && ownedGroups.length === 0 && (
                <p className="text-xs text-gray-500">暂无你创建的分组</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">我加入的分组</p>
            <div className="space-y-2">
              {joinedGroups.map((group) => (
                <button
                  key={group.groupId}
                  type="button"
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full rounded-lg border p-3 text-left ${selectedGroup?.groupId === group.groupId ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                >
                  <p className="truncate text-sm font-medium text-gray-800">{group.name}</p>
                  <p className="text-xs text-gray-500">
                    所有者：{group.ownerName ?? group.ownerId}
                  </p>
                </button>
              ))}
              {!loading && joinedGroups.length === 0 && (
                <p className="text-xs text-gray-500">暂无加入的分组</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {!selectedGroup ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <Users className="h-12 w-12" />
            <p className="mt-2 text-sm">请选择左侧分组</p>
          </div>
        ) : (
          <>
            <div className="mb-4 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">{selectedGroup.name}</h3>
              <p className="text-xs text-gray-500">成员 {members.length}</p>
            </div>

            {isOwner && (
              <div className="mb-4 rounded-lg border border-gray-200 p-3">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={friendKeyword}
                    onChange={(e) => setFriendKeyword(e.target.value)}
                    placeholder="搜索好友添加到分组"
                    className="h-9 w-full rounded-md border border-gray-300 px-9 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {searchableFriends.slice(0, 12).map((f) => (
                    <div
                      key={f.userId}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-800">{f.name}</p>
                        <p className="truncate text-xs text-gray-500">{f.email ?? f.userId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void addMember(f.userId)}
                        disabled={addingMember}
                        className="inline-flex h-7 items-center gap-1 rounded bg-blue-600 px-2 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <UserPlus className="h-3 w-3" /> 添加
                      </button>
                    </div>
                  ))}
                  {searchableFriends.length === 0 && (
                    <p className="text-xs text-gray-500">没有可添加的好友</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {membersLoading && <p className="text-sm text-gray-500">成员加载中...</p>}
              {!membersLoading && members.length === 0 && (
                <p className="text-sm text-gray-500">暂无成员</p>
              )}
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.name ?? member.userId}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                        {(member.name ?? member.userId).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {member.name ?? member.userId}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {member.email ?? member.userId}
                      </p>
                    </div>
                  </div>

                  {isOwner && member.userId !== userId ? (
                    <button
                      type="button"
                      onClick={() => void removeMember(member.userId)}
                      className="rounded p-1 text-rose-600 hover:bg-rose-50"
                      title="移除成员"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
