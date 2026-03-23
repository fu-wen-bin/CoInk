import type { Editor } from '@tiptap/react';
import type * as Y from 'yjs';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

export interface DocumentHeaderProps {
  provider?: unknown;
  connectedUsers?: CollaborationUser[];
  currentUser?: CollaborationUser | null;
  documentId?: string;
  documentName?: string;
  documentTitle?: string;
  doc?: Y.Doc;
  // 新增：侧边栏控制
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
  // 新增：连接状态
  connectionStatus?: string;
  /** 协同落库成功后由 Hocuspocus stateless 推送的 ISO 时间，用于 Header「最近修改」 */
  cloudSavedUpdatedAt?: string | null;
  /** 本地编辑后、尚未收到落库确认时展示「正在保存到云端」 */
  isCloudSaving?: boolean;
}

export interface DocumentActionsProps {
  editor: Editor;
  documentId?: string;
  documentTitle: string;
  doc?: Y.Doc;
}

export interface CollaborationUsersProps {
  users: CollaborationUser[];
  currentUser?: CollaborationUser | null;
}

export interface UserAvatarProps {
  user: CollaborationUser;
  currentUser?: CollaborationUser | null;
  index: number;
  total: number;
}
