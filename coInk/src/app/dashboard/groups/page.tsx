'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Edit2, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { groupsApi } from '@/services/groups';
import type { Group, GroupMember } from '@/services/groups/types';
import { UserApi } from '@/services/users';
import type { User } from '@/services/users/types';
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
  type ConfirmAction =
    | { type: 'group'; groupId: string; name: string }
    | { type: 'member'; targetUserId: string; displayName: string };

  const [userId, setUserId] = useState('');
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [createName, setCreateName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [userKeyword, setUserKeyword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setUserId(getCurrentUserId());
  }, []);

  const resolveUserId = useCallback((): string => {
    if (userId) return userId;
    const fallbackId = getCurrentUserId();
    if (fallbackId) setUserId(fallbackId);
    return fallbackId;
  }, [userId]);

  const loadBaseData = useCallback(async () => {
    const effectiveUserId = resolveUserId();
    if (!effectiveUserId) return;
    setLoading(true);
    const ownedRes = await groupsApi.getOwnedGroups(effectiveUserId);
    setLoading(false);

    if (ownedRes.error) toastError(ownedRes.error);

    setOwnedGroups(ownedRes.data?.data?.groups ?? []);
  }, [resolveUserId]);

  const loadMembers = useCallback(async () => {
    if (!selectedGroup) {
      setMembers([]);
      return;
    }
    // Optimistic groups are local placeholders; skip remote member lookup.
    if (selectedGroup.groupId.startsWith('temp_')) {
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
    const payload = res.data?.data;
    setMembers(Array.isArray(payload) ? payload : (payload?.members ?? []));
  }, [selectedGroup]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    const canManageGroup = selectedGroup?.ownerId === userId;
    if (!canManageGroup || !selectedGroup) {
      setUserSearchResults([]);
      return;
    }

    const keyword = userKeyword.trim();
    if (!keyword) {
      setUserSearchResults([]);
      return;
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(async () => {
      const { data, error } = await UserApi.searchUsers({ q: keyword });
      if (error) {
        toastError(error);
        return;
      }
      setUserSearchResults(data?.data ?? []);
    }, 350);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [selectedGroup, userId, userKeyword]);

  const createGroup = async () => {
    const effectiveUserId = resolveUserId();
    if (!effectiveUserId) {
      toastError('请先登录后再创建分组');
      return;
    }
    const name = createName.trim();
    if (!name) {
      toastError('请输入分组名称');
      return;
    }

    setCreatingGroup(true);

    const tempGroupId = `temp_${Date.now()}`;
    const tempGroup: Group = {
      groupId: tempGroupId,
      name,
      ownerId: effectiveUserId,
      createdAt: new Date().toISOString(),
      memberCount: 0,
    };

    setOwnedGroups((prev) => [tempGroup, ...prev]);
    setCreateName('');

    const res = await groupsApi.createGroup({ name, ownerId: effectiveUserId });
    setCreatingGroup(false);

    if (res.error) {
      setOwnedGroups((prev) => prev.filter((group) => group.groupId !== tempGroupId));
      setSelectedGroup((prev) => (prev?.groupId === tempGroupId ? null : prev));
      toastError(res.error);
      return;
    }

    const createdGroup = res.data?.data;
    if (createdGroup) {
      setOwnedGroups((prev) => [
        createdGroup,
        ...prev.filter((group) => group.groupId !== tempGroupId),
      ]);
      setSelectedGroup(createdGroup);
    }

    toastSuccess('分组已创建');
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
    if (!selectedGroup) return;
    const res = await groupsApi.removeMember(selectedGroup.groupId, targetUserId, userId);
    if (res.error) {
      toastError(res.error);
      return;
    }
    toastSuccess('成员已移除');
    void loadMembers();
    void loadBaseData();
  };

  const requestRemoveGroup = (group: Group) => {
    setConfirmAction({
      type: 'group',
      groupId: group.groupId,
      name: group.name,
    });
  };

  const requestRemoveMember = (member: GroupMember) => {
    setConfirmAction({
      type: 'member',
      targetUserId: member.userId,
      displayName: member.name ?? member.userId,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || confirming) return;
    setConfirming(true);

    if (confirmAction.type === 'group') {
      await removeGroup(confirmAction.groupId);
    } else {
      await removeMember(confirmAction.targetUserId);
    }

    setConfirming(false);
    setConfirmAction(null);
  };

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const visibleMembers = useMemo(
    () => members.filter((member) => member.userId !== userId),
    [members, userId],
  );
  const isOwner = selectedGroup?.ownerId === userId;
  const searchableUsers = useMemo(
    () =>
      userSearchResults.filter(
        (candidate) => !memberIds.has(candidate.userId) && candidate.userId !== userId,
      ),
    [memberIds, userId, userSearchResults],
  );
  const toDisplayMemberCount = (group: Group) => {
    if (selectedGroup?.groupId === group.groupId && members.length > 0) {
      return visibleMembers.length;
    }

    // 后端成员数包含当前用户本人，前端展示统一排除自己。
    return Math.max((group.memberCount ?? 0) - 1, 0);
  };

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
            disabled={creatingGroup}
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {creatingGroup ? '创建中...' : '新建'}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">我的分组</p>
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
                        <p className="text-xs text-gray-500">{toDisplayMemberCount(group)} 成员</p>
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
                          onClick={() => requestRemoveGroup(group)}
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
                <p className="text-xs text-gray-500">暂无分组，请创建一个</p>
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
              <p className="text-xs text-gray-500">成员 {visibleMembers.length}</p>
            </div>

            {isOwner && (
              <div className="mb-4 rounded-lg border border-gray-200 p-3">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={userKeyword}
                    onChange={(e) => setUserKeyword(e.target.value)}
                    placeholder="搜索用户添加到分组"
                    className="h-9 w-full rounded-md border border-gray-300 px-9 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {searchableUsers.slice(0, 12).map((candidate) => (
                    <div
                      key={candidate.userId}
                      className="flex w-full items-center justify-between rounded-md border border-gray-100 px-2 py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {candidate.avatarUrl ? (
                          <img
                            src={candidate.avatarUrl}
                            alt={candidate.name ?? candidate.userId}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                            {(candidate.name ?? candidate.userId).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm text-gray-800">{candidate.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            {candidate.email ?? candidate.userId}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void addMember(candidate.userId)}
                        disabled={addingMember}
                        className="inline-flex h-7 items-center gap-1 rounded bg-blue-600 px-2 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <UserPlus className="h-3 w-3" /> 添加
                      </button>
                    </div>
                  ))}
                  {userKeyword.trim() && searchableUsers.length === 0 && (
                    <p className="text-xs text-gray-500">没有可添加的用户</p>
                  )}
                  {!userKeyword.trim() && (
                    <p className="text-xs text-gray-500">输入用户名或邮箱搜索全站用户</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {membersLoading && <p className="text-sm text-gray-500">成员加载中...</p>}
              {!membersLoading && visibleMembers.length === 0 && (
                <p className="text-sm text-gray-500">暂无成员</p>
              )}
              {visibleMembers.map((member) => (
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
                      onClick={() => requestRemoveMember(member)}
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

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !confirming) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'group' ? '删除分组' : '移除成员'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'group'
                ? `确定删除分组「${confirmAction.name}」吗？该操作不可撤销。`
                : `确定将「${confirmAction?.displayName ?? ''}」移出当前分组吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmAction()}
              disabled={confirming}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {confirming ? '处理中...' : '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
