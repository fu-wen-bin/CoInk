'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Link2,
  MessageCircle,
  QrCode,
  Settings,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';

import { documentsApi } from '@/services/documents';
import type { DocumentPrincipalItem, PermissionLevel } from '@/services/documents/types';
import { friendService } from '@/services/friend';
import { groupsApi } from '@/services/groups';
import type { GroupMember } from '@/services/groups/types';
import { UserApi } from '@/services/users';
import type { FileItem } from '@/types/file-system';
import { toastError, toastSuccess } from '@/utils/toast';

type ShareDialogVariant = 'dropdown' | 'modal';

type GroupOption = {
  groupId: string;
  name: string;
};

type PermissionTarget = {
  targetId: string;
  permission: PermissionLevel;
};

interface ShareDialogProps {
  file: FileItem;
  isOpen: boolean;
  onClose: () => void;
  variant?: ShareDialogVariant;
  anchorRef?: RefObject<HTMLElement | null>;
}

const PERMISSIONS: PermissionLevel[] = ['view', 'comment', 'edit', 'manage'];
const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  view: '可阅读',
  comment: '可评论',
  edit: '可编辑',
  manage: '完全管理',
};

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

export default function ShareDialog({
  file,
  isOpen,
  onClose,
  variant = 'modal',
  anchorRef,
}: ShareDialogProps) {
  const docId = String(file.id);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentPermission, setCurrentPermission] = useState<PermissionLevel | null>(null);
  const [linkPermission, setLinkPermission] = useState<'close' | 'view' | 'edit'>('close');
  const [shareUrl, setShareUrl] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<
    Array<{ userId: string; name: string; email?: string | null; avatarUrl?: string | null }>
  >([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [ownerId, setOwnerId] = useState<string>('');
  const [ownerMeta, setOwnerMeta] = useState<{ name: string; avatarUrl?: string | null } | null>(
    null,
  );
  const [selectedUsers, setSelectedUsers] = useState<PermissionTarget[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<PermissionTarget[]>([]);
  const [friends, setFriends] = useState<Array<{ userId: string; name: string }>>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [principals, setPrincipals] = useState<DocumentPrincipalItem[]>([]);

  const [activeGroupId, setActiveGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [memberUserInput, setMemberUserInput] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<
    Array<{ userId: string; name: string; email?: string | null; avatarUrl?: string | null }>
  >([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [memberPermissionDraft, setMemberPermissionDraft] = useState<
    Record<string, PermissionLevel | 'inherit'>
  >({});
  const [memberEffectivePermission, setMemberEffectivePermission] = useState<
    Record<string, PermissionLevel | null>
  >({});
  const [memberEffectiveSource, setMemberEffectiveSource] = useState<Record<string, string | null>>(
    {},
  );
  const [principalPermissionDraft, setPrincipalPermissionDraft] = useState<
    Record<string, PermissionLevel>
  >({});
  const [principalSavingKey, setPrincipalSavingKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const [view, setView] = useState<'main' | 'settings' | 'invite'>('main');

  const panelRef = useRef<HTMLDivElement>(null);

  const [groupSearchKeyword, setGroupSearchKeyword] = useState('');

  const handleClose = useCallback(() => {
    setView('main');
    setShowUserDropdown(false);
    setUserInput('');
    setGroupSearchKeyword('');
    onClose();
  }, [onClose]);

  const selectedCount = selectedUsers.length + selectedGroups.length;
  const canManage = currentPermission === 'manage';
  const availableFriendIds = useMemo(() => friends.map((item) => item.userId), [friends]);
  const availableGroupIds = useMemo(() => groups.map((item) => item.groupId), [groups]);
  const selectedUsersMeta = useMemo(() => {
    const friendMap = new Map(
      friends.map((item) => [item.userId, { name: item.name, avatarUrl: null }]),
    );
    const searchMap = new Map(
      userSearchResults.map((item) => [
        item.userId,
        { name: item.name, avatarUrl: item.avatarUrl ?? null },
      ]),
    );
    return selectedUsers.map((target) => {
      const fromFriend = friendMap.get(target.targetId);
      const fromSearch = searchMap.get(target.targetId);
      return {
        userId: target.targetId,
        name: fromFriend?.name ?? fromSearch?.name ?? target.targetId,
        avatarUrl: fromSearch?.avatarUrl ?? null,
        permission: target.permission,
      };
    });
  }, [friends, selectedUsers, userSearchResults]);
  const selectedGroupsMeta = useMemo(() => {
    const groupMap = new Map(groups.map((item) => [item.groupId, item.name]));
    return selectedGroups.map((target) => ({
      groupId: target.targetId,
      name: groupMap.get(target.targetId) ?? target.targetId,
      permission: target.permission,
    }));
  }, [groups, selectedGroups]);

  useEffect(() => {
    if (!isOpen) return;

    const uid = getCurrentUserId();
    setCurrentUserId(uid);

    const load = async () => {
      if (!uid) {
        setCurrentPermission(null);
        setPrincipals([]);
        setGroups([]);
        setFriends([]);
        return;
      }

      setLoading(true);
      const [permissionRes, docRes] = await Promise.all([
        documentsApi.getCurrentPermission(docId, { userId: uid }),
        documentsApi.getById(docId),
      ]);

      const resolvedPermission = permissionRes.data?.data?.permission ?? null;
      setCurrentPermission(resolvedPermission);

      if (resolvedPermission === 'manage') {
        const [principalRes, friendRes, myGroupsRes, ownedGroupsRes] = await Promise.all([
          documentsApi.getPrincipals(docId, uid),
          friendService.getFriendList(uid),
          groupsApi.getMyGroups(uid),
          groupsApi.getOwnedGroups(uid),
        ]);

        if (principalRes.error) {
          toastError(principalRes.error);
        } else {
          const payload = principalRes.data?.data;
          if (payload) {
            setPrincipals(payload.principals ?? []);
            setOwnerId(payload.ownerId ?? '');
            setOwnerMeta(
              payload.ownerName
                ? {
                    name: payload.ownerName,
                    avatarUrl: payload.ownerAvatarUrl ?? null,
                  }
                : null,
            );
            setLinkPermission(
              (payload.linkPermission as 'close' | 'view' | 'edit' | null) ?? 'close',
            );
          }
        }

        if (!friendRes.error) {
          const list = friendRes.data?.data ?? [];
          setFriends(list.map((item) => ({ userId: item.userId, name: item.name })));
        }

        const mergeGroups = [
          ...(myGroupsRes.data?.data?.groups ?? []),
          ...(ownedGroupsRes.data?.data?.groups ?? []),
        ];
        const unique = new Map<string, GroupOption>();
        for (const item of mergeGroups) {
          unique.set(item.groupId, { groupId: item.groupId, name: item.name });
        }
        setGroups(Array.from(unique.values()));
      } else {
        setPrincipals([]);
        setSelectedUsers([]);
        setSelectedGroups([]);
        setGroupMembers([]);
        setGroups([]);
        setFriends([]);
      }

      if (!docRes.error) {
        const shareToken = docRes.data?.data?.shareToken;
        const ownerFromDoc = docRes.data?.data?.ownerId;
        if (ownerFromDoc) {
          setOwnerId(ownerFromDoc);
        }
        if (shareToken && typeof window !== 'undefined') {
          setShareUrl(`${window.location.origin}/share/${shareToken}`);
        }
      }

      setLoading(false);
    };

    void load();
  }, [file.id, isOpen]);

  useEffect(() => {
    if (!isOpen || variant !== 'dropdown') return;

    const updatePosition = () => {
      const rect = anchorRef?.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(12, rect.right - 520),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, isOpen, variant]);

  useEffect(() => {
    if (!isOpen) return;

    const onDocDown = (event: MouseEvent) => {
      if (variant !== 'dropdown') return;
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        handleClose();
      }
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [handleClose, isOpen, variant]);

  useEffect(() => {
    if (isOpen) return;
    setView('main');
    setShowUserDropdown(false);
    setUserInput('');
    setGroupSearchKeyword('');
  }, [isOpen]);

  useEffect(() => {
    const draft: Record<string, PermissionLevel> = {};
    principals.forEach((item) => {
      draft[principalKeyOf(item)] = item.permission;
    });
    setPrincipalPermissionDraft(draft);
  }, [principals]);

  const refreshPrincipals = async () => {
    if (!currentUserId) return;
    const refreshed = await documentsApi.getPrincipals(docId, currentUserId);
    if (!refreshed.error) {
      setPrincipals(refreshed.data?.data?.principals ?? []);
    }
  };

  const principalKeyOf = (item: { principalType: 'user' | 'group'; principalId: string }) =>
    `${item.principalType}:${item.principalId}`;

  const formatPermissionSource = (source: string | null | undefined): string => {
    const map: Record<string, string> = {
      owner: '所有者',
      direct: '直授',
      group: '组继承',
      link: '链接',
    };
    if (!source) return '未知';
    return map[source] ?? source;
  };

  const handleUserSearch = (value: string) => {
    setUserInput(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    setShowUserDropdown(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const { data } = await UserApi.searchUsers({ q: value });
      if (data?.data) {
        const selectedIds = new Set(selectedUsers.map((item) => item.targetId));
        const results = data.data.filter((u) => !selectedIds.has(u.userId));
        setUserSearchResults(results);
      }
    }, 500);
  };

  const selectUser = (userId: string) => {
    setSelectedUsers((prev) => {
      if (prev.some((item) => item.targetId === userId)) {
        return prev;
      }
      return [...prev, { targetId: userId, permission: 'edit' }];
    });
    setUserInput('');
    setUserSearchResults([]);
    setShowUserDropdown(false);
  };

  const selectGroup = (groupId: string) => {
    if (!groupId) return;
    setSelectedGroups((prev) => {
      if (prev.some((item) => item.targetId === groupId)) {
        return prev;
      }
      return [...prev, { targetId: groupId, permission: 'edit' }];
    });
  };

  const updateSelectedUserPermission = (userId: string, permission: PermissionLevel) => {
    setSelectedUsers((prev) =>
      prev.map((item) => (item.targetId === userId ? { ...item, permission } : item)),
    );
  };

  const updateSelectedGroupPermission = (groupId: string, permission: PermissionLevel) => {
    setSelectedGroups((prev) =>
      prev.map((item) => (item.targetId === groupId ? { ...item, permission } : item)),
    );
  };

  const loadGroupMembers = async (groupId: string) => {
    if (!groupId) {
      setGroupMembers([]);
      setMemberPermissionDraft({});
      setMemberEffectivePermission({});
      setMemberEffectiveSource({});
      return;
    }

    const memberRes = await groupsApi.getGroupMembers(groupId);
    const members = memberRes.data?.data?.members ?? [];
    setGroupMembers(members);

    const userPrincipalMap = new Map(
      principals
        .filter((item) => item.principalType === 'user')
        .map((item) => [item.principalId, item.permission]),
    );
    const draft: Record<string, PermissionLevel | 'inherit'> = {};
    members.forEach((member) => {
      draft[member.userId] = userPrincipalMap.get(member.userId) ?? 'inherit';
    });
    setMemberPermissionDraft(draft);

    const effectiveEntries = await Promise.all(
      members.map(async (member) => {
        const { data } = await documentsApi.getCurrentPermission(docId, { userId: member.userId });
        return {
          userId: member.userId,
          permission: data?.data?.permission ?? null,
          source: data?.data?.source ?? null,
        };
      }),
    );
    setMemberEffectivePermission(
      Object.fromEntries(effectiveEntries.map((entry) => [entry.userId, entry.permission])),
    );
    setMemberEffectiveSource(
      Object.fromEntries(effectiveEntries.map((entry) => [entry.userId, entry.source])),
    );
  };

  const handleMemberSearch = (value: string) => {
    setMemberUserInput(value);

    if (memberSearchTimeoutRef.current) {
      clearTimeout(memberSearchTimeoutRef.current);
    }

    if (!value.trim() || !activeGroupId) {
      setMemberSearchResults([]);
      setShowMemberDropdown(false);
      return;
    }

    setShowMemberDropdown(true);
    memberSearchTimeoutRef.current = setTimeout(async () => {
      const { data } = await UserApi.searchUsers({ q: value });
      if (data?.data) {
        const existingIds = new Set(groupMembers.map((member) => member.userId));
        setMemberSearchResults(data.data.filter((user) => !existingIds.has(user.userId)));
      }
    }, 400);
  };

  const addMemberToActiveGroup = async (targetUserId: string) => {
    if (!activeGroupId || !currentUserId) {
      toastError('请先选择权限组');
      return;
    }

    const { error } = await groupsApi.addMember(activeGroupId, {
      targetUserId,
      userId: currentUserId,
    });
    if (error) {
      toastError(error);
      return;
    }

    setMemberUserInput('');
    setMemberSearchResults([]);
    setShowMemberDropdown(false);
    await loadGroupMembers(activeGroupId);
    toastSuccess('已添加组成员');
  };

  const removeMemberFromActiveGroup = async (targetUserId: string) => {
    if (!activeGroupId || !currentUserId) return;

    const { error } = await groupsApi.removeMember(activeGroupId, targetUserId, currentUserId);
    if (error) {
      toastError(error);
      return;
    }

    await loadGroupMembers(activeGroupId);
    toastSuccess('已移出权限组');
  };

  const saveMemberPermission = async (targetUserId: string) => {
    const nextPermission = memberPermissionDraft[targetUserId] ?? 'inherit';

    if (nextPermission === 'inherit') {
      const { error } = await documentsApi.batchRemovePermissions(docId, {
        userIds: [targetUserId],
        groupIds: [],
      });
      if (error) {
        toastError(error);
        return;
      }
    } else {
      const { error } = await documentsApi.batchUpsertPermissions(docId, {
        sendNotification: false,
        userTargets: [{ targetId: targetUserId, permission: nextPermission }],
        groupTargets: [],
      });
      if (error) {
        toastError(error);
        return;
      }
    }

    await refreshPrincipals();
    if (activeGroupId) {
      await loadGroupMembers(activeGroupId);
    }
    toastSuccess('成员权限已保存');
  };

  const savePrincipalPermission = async (item: DocumentPrincipalItem) => {
    if (!currentUserId) return;

    const key = principalKeyOf(item);
    const nextPermission = principalPermissionDraft[key] ?? item.permission;

    setPrincipalSavingKey(key);
    const { error } = await documentsApi.batchUpsertPermissions(docId, {
      sendNotification: false,
      userTargets:
        item.principalType === 'user'
          ? [{ targetId: item.principalId, permission: nextPermission }]
          : [],
      groupTargets:
        item.principalType === 'group'
          ? [{ targetId: item.principalId, permission: nextPermission }]
          : [],
    });
    setPrincipalSavingKey('');

    if (error) {
      toastError(error);
      return;
    }

    await refreshPrincipals();
    if (activeGroupId) {
      await loadGroupMembers(activeGroupId);
    }
    toastSuccess('协作者权限已更新');
  };

  const removePrincipal = async (principalType: 'user' | 'group', principalId: string) => {
    if (!currentUserId) return;

    const { error } = await documentsApi.batchRemovePermissions(docId, {
      userIds: principalType === 'user' ? [principalId] : [],
      groupIds: principalType === 'group' ? [principalId] : [],
    });

    if (error) {
      toastError(error);
      return;
    }

    setPrincipals((prev) =>
      prev.filter(
        (item) => !(item.principalType === principalType && item.principalId === principalId),
      ),
    );
    toastSuccess('已移除权限');
  };

  const applyBatchPermissions = async () => {
    if (!currentUserId) {
      toastError('请先登录');
      return;
    }

    if (selectedCount === 0) {
      toastError('请先添加用户或用户组');
      return;
    }

    setLoading(true);
    const { error } = await documentsApi.batchUpsertPermissions(docId, {
      sendNotification,
      userTargets: selectedUsers,
      groupTargets: selectedGroups,
    });
    setLoading(false);

    if (error) {
      toastError(error);
      return;
    }

    await refreshPrincipals();
    setSelectedUsers([]);
    setSelectedGroups([]);
    toastSuccess('权限设置成功');
  };

  const applyLinkPermission = async () => {
    setLoading(true);

    if (linkPermission === 'close') {
      const { error } = await documentsApi.closeShare(docId);
      setLoading(false);
      if (error) {
        toastError(error);
        return;
      }
      toastSuccess('已关闭链接分享');
      return;
    }

    const { data, error } = await documentsApi.share(docId, {
      permission: linkPermission,
    });
    setLoading(false);

    if (error) {
      toastError(error);
      return;
    }

    const token = data?.data?.shareToken;
    if (token && typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/share/${token}`);
    }
    toastSuccess('链接权限已更新');
  };

  const copyLink = async () => {
    if (!shareUrl) {
      toastError('暂无可复制链接，请先开启链接分享');
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    toastSuccess('链接已复制');
  };

  const selectPendingUser = (user: { userId: string; name: string }) => {
    if (principals.some((p) => p.principalId === user.userId)) {
      toastError('该用户已经是协作者');
      return;
    }

    setSelectedUsers((prev) => {
      if (prev.some((item) => item.targetId === user.userId)) return prev;
      return [...prev, { targetId: user.userId, permission: 'edit' }];
    });

    setUserInput('');
    setUserSearchResults([]);
    setShowUserDropdown(false);
    setView('invite');
  };

  const confirmAddUser = async () => {
    if (selectedCount === 0) {
      toastError('请至少选择一个好友或分组');
      return;
    }

    setLoading(true);
    const { error } = await documentsApi.batchUpsertPermissions(docId, {
      sendNotification,
      userTargets: selectedUsers,
      groupTargets: selectedGroups,
    });
    setLoading(false);

    if (error) {
      toastError(error);
      return;
    }

    await refreshPrincipals();
    setUserInput('');
    setSelectedUsers([]);
    setSelectedGroups([]);
    setGroupSearchKeyword('');
    toastSuccess('协作者权限已添加');
    setView('settings');
  };

  const panel = (
    <div
      ref={panelRef}
      className="w-[560px] max-w-[calc(100vw-24px)] overflow-visible rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          {view !== 'main' && (
            <button
              onClick={() => setView(view === 'invite' ? 'main' : 'main')}
              className="mr-1 text-slate-500 hover:bg-slate-100 rounded-full p-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h3 className="text-lg font-semibold text-slate-900">
            {view === 'main' && '分享文档'}
            {view === 'settings' && '管理协作者'}
            {view === 'invite' && '添加协作者'}
          </h3>
          {view === 'main' && (
            <button className="text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {view === 'main' && canManage && (
            <button
              type="button"
              onClick={() => setView('settings')}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
            >
              <Settings className="h-4 w-4" />
              权限设置
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'main' && (
        <div className="p-5">
          {/* Invite Collaborators Section */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">邀请协作者</div>

              {/* Avatar Stack acting as button to Settings */}
              <button
                onClick={() => setView('settings')}
                className="flex items-center -space-x-2 hover:opacity-80 transition-opacity"
                title="管理协作者"
              >
                {principals.slice(0, 5).map((p) => (
                  <div
                    key={p.principalId}
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 ring-2 ring-white"
                    title={p.name}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-violet-700">
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                ))}
                {principals.length > 5 && (
                  <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white">
                    <span className="text-xs text-slate-600">+{principals.length - 5}</span>
                  </div>
                )}
                <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            </div>

            {/* Main View Input - Quick Invite Entry */}
            {canManage && (
              <div className="relative">
                <input
                  value={userInput}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="可搜索用户名添加协作者"
                  className="w-full rounded-md border border-blue-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {showUserDropdown && userSearchResults.length > 0 && (
                  <div
                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {userSearchResults.map((user) => (
                      <button
                        key={user.userId}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectPendingUser(user);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            user.name.slice(0, 1)
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-50">
            {/* Link Share Card - Only if canManage */}
            {canManage && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      linkPermission === 'close' ? 'bg-slate-100' : 'bg-blue-600'
                    }`}
                  >
                    {linkPermission === 'close' ? (
                      <div className="flex text-slate-500">
                        <span className="text-lg font-bold">8</span>
                      </div>
                    ) : (
                      <Globe className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {linkPermission === 'close' ? '未开启链接分享' : '互联网获得链接的人'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500">
                      {linkPermission === 'close'
                        ? '仅协作者可访问'
                        : linkPermission === 'view'
                          ? '互联网获得链接的人可阅读'
                          : '互联网获得链接的人可编辑'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={linkPermission}
                    onChange={(e) => setLinkPermission(e.target.value as any)}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
                  >
                    <option value="close">关闭</option>
                    <option value="view">可阅读</option>
                    <option value="edit">可编辑</option>
                  </select>
                  <button
                    onClick={() => applyLinkPermission()}
                    disabled={loading}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}

            {/* Social Share Buttons */}
            <div className={`flex items-center gap-3 ${!canManage ? 'mt-0' : 'pt-2'}`}>
              <button
                onClick={() => copyLink()}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Link2 className="h-4 w-4" />
                复制链接
              </button>

              {[
                { icon: <MessageCircle className="h-4 w-4" />, label: 'WeChat' },
                { icon: <QrCode className="h-4 w-4" />, label: 'QR' },
              ].map((item, i) => (
                <button
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
              <div className="flex-1"></div>
            </div>

            {/* Removed Bottom URL Input as requested */}
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div className="flex h-[400px] flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 text-xs text-slate-500">所有可访问此文档的用户</div>
            <div className="space-y-4">
              {ownerMeta && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-400 text-white text-sm font-medium">
                      {ownerMeta.avatarUrl ? (
                        <img
                          src={ownerMeta.avatarUrl}
                          className="h-full w-full rounded-full"
                          alt=""
                        />
                      ) : (
                        ownerMeta.name.slice(0, 1)
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{ownerMeta.name}</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                        所有者
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-slate-500">可管理</span>
                </div>
              )}

              {principals
                .filter((p) => p.principalId !== ownerId)
                .map((item) => (
                  <div key={principalKeyOf(item)} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-sm font-medium">
                        {item.avatarUrl ? (
                          <img src={item.avatarUrl} className="h-full w-full rounded-full" alt="" />
                        ) : (
                          item.name.slice(0, 1)
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={principalPermissionDraft[principalKeyOf(item)] ?? item.permission}
                        onChange={(e) => {
                          setPrincipalPermissionDraft((prev) => ({
                            ...prev,
                            [principalKeyOf(item)]: e.target.value as any,
                          }));
                          // Auto save on change for better UX like Figure 5 usually implies, or keep save button?
                          // Figure 5 shows "Can Read" dropdown.
                        }}
                        className="text-sm text-slate-600 bg-transparent border-none focus:ring-0 cursor-pointer"
                      >
                        {PERMISSIONS.map((p) => (
                          <option key={p} value={p}>
                            {PERMISSION_LABELS[p]}
                          </option>
                        ))}
                      </select>
                      {principalPermissionDraft[principalKeyOf(item)] &&
                        principalPermissionDraft[principalKeyOf(item)] !== item.permission && (
                          <button
                            onClick={() => savePrincipalPermission(item)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            保存
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => removePrincipal(item.principalType, item.principalId)}
                        className="text-rose-600 text-xs hover:underline ml-2"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="border-t border-slate-100 p-4">
            <button
              onClick={() => setView('invite')}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <UserPlus className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">添加协作者</span>
            </button>
          </div>
        </div>
      )}

      {view === 'invite' && (
        <div className="p-5">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-500">搜索好友</label>
              <div className="relative">
                <input
                  value={userInput}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="输入好友用户名/邮箱"
                  className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                {showUserDropdown && userSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {userSearchResults.map((user) => (
                      <button
                        key={user.userId}
                        onClick={() => selectPendingUser(user)}
                        className="flex w-full items-center gap-3 px-4 py-2 hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            user.name.slice(0, 1)
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email ?? user.userId}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-500">搜索分组</label>
              <input
                value={groupSearchKeyword}
                onChange={(e) => setGroupSearchKeyword(e.target.value)}
                placeholder="输入分组名称"
                className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="mt-2 max-h-32 space-y-2 overflow-y-auto">
                {groups
                  .filter((g) =>
                    groupSearchKeyword.trim()
                      ? g.name.toLowerCase().includes(groupSearchKeyword.trim().toLowerCase())
                      : true,
                  )
                  .slice(0, 8)
                  .map((group) => {
                    const selected = selectedGroups.some((item) => item.targetId === group.groupId);
                    return (
                      <button
                        key={group.groupId}
                        type="button"
                        onClick={() => selectGroup(group.groupId)}
                        className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="text-sm text-slate-700">{group.name}</span>
                        <span className="text-xs text-slate-500">{selected ? '已选' : '添加'}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">待授权目标</p>
              <div className="space-y-2">
                {selectedUsersMeta.map((item) => (
                  <div key={`u:${item.userId}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">好友</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={item.permission}
                        onChange={(e) =>
                          updateSelectedUserPermission(
                            item.userId,
                            e.target.value as PermissionLevel,
                          )
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        {PERMISSIONS.map((p) => (
                          <option key={p} value={p}>
                            {PERMISSION_LABELS[p]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedUsers((prev) => prev.filter((x) => x.targetId !== item.userId))
                        }
                        className="rounded p-1 text-rose-600 hover:bg-rose-50"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {selectedGroupsMeta.map((item) => (
                  <div
                    key={`g:${item.groupId}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">分组</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={item.permission}
                        onChange={(e) =>
                          updateSelectedGroupPermission(
                            item.groupId,
                            e.target.value as PermissionLevel,
                          )
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        {PERMISSIONS.map((p) => (
                          <option key={p} value={p}>
                            {PERMISSION_LABELS[p]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedGroups((prev) =>
                            prev.filter((x) => x.targetId !== item.groupId),
                          )
                        }
                        className="rounded p-1 text-rose-600 hover:bg-rose-50"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {selectedCount === 0 && <p className="text-xs text-slate-400">还未选择目标</p>}
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-900">发送通知</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setView('settings')}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={confirmAddUser}
                disabled={loading || selectedCount === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                确认授权
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {variant === 'dropdown' && position && (
        <div
          className="fixed z-[120]"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {panel}
        </div>
      )}

      {variant === 'modal' && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          onClick={handleClose}
        >
          <div onClick={(e) => e.stopPropagation()}>{panel}</div>
        </div>
      )}
    </>
  );
}
