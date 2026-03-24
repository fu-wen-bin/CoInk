'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Copy, X } from 'lucide-react';

import { documentsApi } from '@/services/documents';
import type { DocumentPrincipalItem, PermissionLevel } from '@/services/documents/types';
import { friendService } from '@/services/friend';
import { groupsApi } from '@/services/groups';
import type { FileItem } from '@/types/file-system';
import { toastError, toastSuccess } from '@/utils/toast';

type ShareDialogVariant = 'dropdown' | 'modal';

type GroupOption = {
  groupId: string;
  name: string;
};

interface ShareDialogProps {
  file: FileItem;
  isOpen: boolean;
  onClose: () => void;
  variant?: ShareDialogVariant;
  anchorRef?: RefObject<HTMLElement | null>;
}

const PERMISSIONS: PermissionLevel[] = ['view', 'comment', 'edit', 'manage', 'full'];

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
  const [currentUserId, setCurrentUserId] = useState('');
  const [linkPermission, setLinkPermission] = useState<'close' | 'view' | 'edit'>('close');
  const [shareUrl, setShareUrl] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>('view');
  const [sendNotification, setSendNotification] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<Array<{ userId: string; name: string }>>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [principals, setPrincipals] = useState<DocumentPrincipalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedUserIds.length + selectedGroupIds.length;
  const availableFriendIds = useMemo(() => friends.map((item) => item.userId), [friends]);
  const availableGroupIds = useMemo(() => groups.map((item) => item.groupId), [groups]);

  useEffect(() => {
    if (!isOpen) return;

    const uid = getCurrentUserId();
    setCurrentUserId(uid);

    const load = async () => {
      if (!uid) return;

      setLoading(true);
      const docId = String(file.id);
      const [principalRes, docRes, friendRes, myGroupsRes, ownedGroupsRes] = await Promise.all([
        documentsApi.getPrincipals(docId, uid),
        documentsApi.getById(docId),
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
          setLinkPermission(
            (payload.linkPermission as 'close' | 'view' | 'edit' | null) ?? 'close',
          );
        }
      }

      if (!docRes.error) {
        const shareToken = docRes.data?.data?.shareToken;
        if (shareToken && typeof window !== 'undefined') {
          setShareUrl(`${window.location.origin}/share/${shareToken}`);
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
        onClose();
      }
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isOpen, onClose, variant]);

  if (!isOpen) return null;

  const addUserId = () => {
    const value = userInput.trim();
    if (!value) return;
    if (!selectedUserIds.includes(value)) {
      setSelectedUserIds((prev) => [...prev, value]);
    }
    setUserInput('');
  };

  const addGroupId = () => {
    const value = groupInput.trim();
    if (!value) return;
    if (!selectedGroupIds.includes(value)) {
      setSelectedGroupIds((prev) => [...prev, value]);
    }
    setGroupInput('');
  };

  const removePrincipal = async (principalType: 'user' | 'group', principalId: string) => {
    if (!currentUserId) return;

    const { error } = await documentsApi.batchRemovePermissions(String(file.id), {
      grantedBy: currentUserId,
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
    const { error } = await documentsApi.batchUpsertPermissions(String(file.id), {
      grantedBy: currentUserId,
      sendNotification,
      userTargets: selectedUserIds.map((targetId) => ({
        targetId,
        permission: selectedPermission,
      })),
      groupTargets: selectedGroupIds.map((targetId) => ({
        targetId,
        permission: selectedPermission,
      })),
    });
    setLoading(false);

    if (error) {
      toastError(error);
      return;
    }

    const refreshed = await documentsApi.getPrincipals(String(file.id), currentUserId);
    if (!refreshed.error) {
      setPrincipals(refreshed.data?.data?.principals ?? []);
    }

    setSelectedUserIds([]);
    setSelectedGroupIds([]);
    toastSuccess('权限设置成功');
  };

  const applyLinkPermission = async () => {
    setLoading(true);

    if (linkPermission === 'close') {
      const { error } = await documentsApi.closeShare(String(file.id));
      setLoading(false);
      if (error) {
        toastError(error);
        return;
      }
      toastSuccess('已关闭链接分享');
      return;
    }

    const { data, error } = await documentsApi.share(String(file.id), {
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

  const panel = (
    <div
      ref={panelRef}
      className="w-[520px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">分享文档</h3>
          <p className="text-xs text-slate-500">{file.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">邀请协作者</div>
          <div className="flex gap-2">
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入用户 ID"
              className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={addUserId}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            >
              添加用户
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              placeholder="输入用户组 ID"
              className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={addGroupId}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            >
              添加用户组
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {selectedUserIds.map((id) => (
              <span
                key={`u-${id}`}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
              >
                用户 {id}
              </span>
            ))}
            {selectedGroupIds.map((id) => (
              <span
                key={`g-${id}`}
                className="rounded-full bg-purple-50 px-3 py-1 text-xs text-purple-700"
              >
                用户组 {id}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
              onClick={() => setSelectedUserIds(availableFriendIds)}
            >
              快捷添加全部好友
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
              onClick={() => setSelectedGroupIds(availableGroupIds)}
            >
              快捷添加全部用户组
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
              onClick={() => {
                setSelectedUserIds([]);
                setSelectedGroupIds([]);
              }}
            >
              清空选择
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">批量设置权限</div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value as PermissionLevel)}
              className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm"
            >
              {PERMISSIONS.map((perm) => (
                <option key={perm} value={perm}>
                  {perm}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void applyBatchPermissions()}
              disabled={loading}
              className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              应用到所选
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
            />
            发送通知
          </label>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">当前协作者权限</div>
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {principals.length === 0 ? (
              <p className="text-xs text-slate-500">暂无协作者</p>
            ) : (
              principals.map((item) => (
                <div
                  key={`${item.principalType}-${item.principalId}`}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <span className="text-slate-700">
                    [{item.principalType}] {item.name} ({item.principalId}) - {item.permission}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removePrincipal(item.principalType, item.principalId)}
                    className="text-rose-600"
                  >
                    移除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="text-sm font-medium text-slate-800">链接分享</div>
          <div className="flex items-center gap-2">
            <select
              value={linkPermission}
              onChange={(e) => setLinkPermission(e.target.value as 'close' | 'view' | 'edit')}
              className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm"
            >
              <option value="close">关闭</option>
              <option value="view">可阅读</option>
              <option value="edit">可编辑</option>
            </select>
            <button
              type="button"
              onClick={() => void applyLinkPermission()}
              disabled={loading}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-700"
            >
              保存
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              placeholder="开启链接分享后可复制链接"
              className="h-9 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 text-xs text-slate-600"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? <p className="text-xs text-slate-500">处理中...</p> : null}
      </div>
    </div>
  );

  if (variant === 'dropdown') {
    if (!position) return null;
    return (
      <div
        className="fixed z-[120]"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {panel}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{panel}</div>
    </div>
  );
}
