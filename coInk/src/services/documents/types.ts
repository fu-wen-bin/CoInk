/**
 * 文档服务类型定义
 *
 * 功能说明：
 * - 定义文档、文档内容、文档版本的实体类型
 * - 定义文档类型、链接权限、权限等级等枚举
 * - 定义创建、更新文档的请求参数类型
 * - 定义各种响应数据类型
 *
 * 后端接口文档：backEnd/docs/API.md
 * 数据库文档：backEnd/docs/DATABASE_SCHEMA.md
 */

import type { ApiResponse } from '@/services/request';

// ==================== 枚举类型 ====================

/**
 * 文档类型枚举
 */
export type DocumentType = 'FILE' | 'FOLDER';

/**
 * 链接分享权限枚举
 */
export type LinkPermission = 'close' | 'view' | 'edit';

/**
 * 权限等级枚举（从高到低）
 * - manage: 完全管理（分享、协作设置、权限管理）
 * - edit: 编辑权限（修改内容）
 * - comment: 评论权限（添加评论）
 * - view: 只读权限
 */
export type PermissionLevel = 'manage' | 'edit' | 'comment' | 'view';

/**
 * 权限来源类型
 */
export type PermissionSource = 'direct' | 'group' | 'link' | 'owner';

// ==================== 实体类型 ====================

/**
 * 文档实体
 * 对应数据库 documents_info 表
 */
export interface Document {
  /** 文档唯一标识 */
  documentId: string;
  /** 文档标题 */
  title: string;
  /** 文档类型：FILE 或 FOLDER */
  type: DocumentType;
  /** 所有者ID */
  ownerId: string;
  /** 父文件夹ID（为空表示根目录） */
  parentId: string | null;
  /** 是否星标 */
  isStarred: boolean;
  /** 排序顺序 */
  sortOrder: number;
  /** 是否已软删除 */
  isDeleted: boolean;
  /** 分享令牌 */
  shareToken: string | null;
  /** 链接分享权限 */
  linkPermission: LinkPermission;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 当前用户最近一次打开该文档的时间（后端按用户维度返回） */
  lastAccessedAt?: string | null;
  /** 父文件夹名称（仅当 parentId 存在且能解析到文件夹时） */
  parentFolderTitle?: string | null;
  /** 所有者信息（可选） */
  owner?: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
  /** 子文档数量（文件夹类型） */
  childrenCount?: number;
  /** 与我共享：当前用户已无访问权限，仅因最近访问/收藏保留在列表；点进文档会提示无权限 */
  sharedAccessDenied?: boolean;
  /** 协作者权限（共享列表等场景，后端可选返回） */
  myPermission?: string;
}

/**
 * 文档内容实体
 * 对应数据库 document_contents 表
 */
export interface DocumentContent {
  /** 文档ID */
  documentId: string;
  /** 文档内容（TipTap JSON 格式） */
  content: Record<string, any>;
  /** 更新时间 */
  updatedAt: string;
  /** 最后更新者ID */
  updatedBy: string;
  /** 最后更新者信息（可选） */
  updatedByUser?: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
}

/**
 * 文档版本实体
 * 对应数据库 document_versions 表
 */
export interface DocumentVersion {
  /** 版本ID（时间戳） */
  versionId: string;
  /** 文档ID */
  documentId: string;
  /** 版本时的标题 */
  title: string;
  /** 版本说明（快照描述） */
  description?: string | null;
  /** 版本内容 */
  content: Record<string, any>;
  /** 创建时间 */
  createdAt: string;
  /** 创建者ID */
  userId: string;
  /** 创建者信息（可选） */
  user?: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
}

/**
 * 文档权限实体
 * 对应数据库 document_principals 表
 */
export interface DocumentPermission {
  /** 文档ID */
  documentId: string;
  /** 主体类型：user 或 group */
  principalType: 'user' | 'group';
  /** 主体ID */
  principalId: string;
  /** 权限级别 */
  permission: PermissionLevel;
  /** 授权者ID */
  grantedBy: string;
  /** 授权时间 */
  grantedAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 过期时间（可选） */
  expiresAt: string | null;
  /** 主体信息（可选） */
  principal?: {
    userId?: string;
    groupId?: string;
    name: string;
    avatarUrl?: string;
  };
}

// ==================== 请求参数类型 ====================

/**
 * 创建文档/文件夹参数
 */
export interface CreateDocumentParams {
  /** 文档标题 */
  title: string;
  /** 文档类型 */
  type: DocumentType;
  /** 所有者ID */
  ownerId: string;
  /** 父文件夹ID（可选） */
  parentId?: string;
  /** 是否星标（可选，默认false） */
  isStarred?: boolean;
}

/**
 * 更新文档参数
 */
export interface UpdateDocumentParams {
  /** 新标题（可选） */
  title?: string;
  /** 新父文件夹ID（可选） */
  parentId?: string;
  /** 是否星标（可选） */
  isStarred?: boolean;
  /** 排序顺序（可选） */
  sortOrder?: number;
  /** 链接分享权限（可选） */
  linkPermission?: LinkPermission;
}

/**
 * 重命名文档参数
 */
export interface RenameDocumentParams {
  /** 新标题 */
  title: string;
}

/**
 * 移动文档参数
 */
export interface MoveDocumentParams {
  /** 目标父文件夹ID */
  parentId: string;
  /** 用户ID */
  userId: string;
}

/**
 * 星标/取消星标文档参数
 */
export interface StarDocumentParams {
  /** 是否星标 */
  isStarred: boolean;
  /** 执行收藏操作的用户（必须与登录用户一致；有文档访问权限即可收藏） */
  userId: string;
}

/**
 * 生成分享链接参数
 */
export interface ShareDocumentParams {
  /** 分享权限 */
  permission: LinkPermission;
}

/**
 * 设置用户权限参数
 */
export interface SetPermissionParams {
  /** 目标用户ID */
  targetUserId: string;
  /** 权限级别 */
  permission: PermissionLevel;
  /** 授权者ID */
  grantedBy: string;
}

/**
 * 移除用户权限参数
 */
export interface RemovePermissionParams {
  /** 目标用户ID */
  targetUserId: string;
  /** 授权者ID */
  grantedBy: string;
}

export interface PrincipalPermissionTarget {
  targetId: string;
  permission: PermissionLevel;
}

export interface BatchUpsertPermissionsParams {
  grantedBy?: string;
  userTargets?: PrincipalPermissionTarget[];
  groupTargets?: PrincipalPermissionTarget[];
  sendNotification?: boolean;
}

export interface BatchRemovePermissionsParams {
  grantedBy?: string;
  userIds?: string[];
  groupIds?: string[];
}

export interface DocumentPrincipalItem {
  principalType: 'user' | 'group';
  principalId: string;
  permission: PermissionLevel;
  name: string;
  avatarUrl?: string | null;
}

export interface DocumentPrincipalsResponse {
  documentId?: string;
  documentTitle?: string;
  documentType?: DocumentType;
  ownerId: string;
  ownerName?: string;
  ownerAvatarUrl?: string | null;
  linkPermission: LinkPermission | null;
  principals: DocumentPrincipalItem[];
}

/**
 * 创建文档内容参数
 */
export interface CreateContentParams {
  /** 文档内容 */
  content: Record<string, any>;
  /** 更新者ID */
  updatedBy: string;
}

/**
 * 更新文档内容参数
 */
export interface UpdateContentParams {
  /** 文档内容 */
  content: Record<string, any>;
  /** 更新者ID */
  updatedBy: string;
}

/**
 * 创建文档版本参数
 */
export interface CreateVersionParams {
  /** 文档 ID（与路径参数一致，后端校验用） */
  documentId: string;
  /** 版本标题 */
  title: string;
  /** 版本说明（快照描述） */
  description?: string;
  /** 版本内容 */
  content: Record<string, any>;
  /** 可选：base64(encodeStateAsUpdate)，与协同 y_state 一致 */
  yStateBase64?: string;
  /** 用户ID */
  userId: string;
}

/**
 * 按父目录获取文档参数
 */
export interface GetByParentParams {
  /** 父文件夹ID（为空表示根目录） */
  parentId?: string;
  /** 用户ID（必填） */
  ownerId: string;
}

/**
 * 获取星标文档参数
 */
export interface GetStarredParams {
  /** 当前用户 ID（收藏列表按该用户维度） */
  userId?: string;
  /** @deprecated 请使用 userId */
  ownerId?: string;
}

/**
 * 获取回收站文档参数
 */
export interface GetDeletedParams {
  /** 用户ID（必填） */
  ownerId: string;
}

/**
 * 获取与我共享的文档参数
 */
export interface GetSharedParams {
  /** 用户ID（必填） */
  userId: string;
}

/**
 * 获取当前用户对文档权限参数
 */
export interface GetPermissionParams {
  /** 用户ID（可选，匿名访问时可不传） */
  userId?: string;
}

/**
 * 记录文档访问（最近访问时间）
 */
export interface RecordAccessParams {
  userId: string;
}

/**
 * 从最近访问列表批量移除
 */
export interface RemoveFromRecentParams {
  userId: string;
  documentIds: string[];
}

// ==================== 响应类型 ====================

/**
 * 文档列表响应数据
 */
export interface DocumentsListResponse {
  /** 文档列表 */
  documents: Document[];
  /** 总数 */
  total: number;
}

/**
 * 当前权限响应数据
 */
export interface CurrentPermissionResponse {
  /** 权限级别 */
  permission: PermissionLevel | null;
  /** 权限来源 */
  source: PermissionSource | null;
  /** 文档标题（供 header/无权限页直接展示） */
  documentTitle?: string;
  /** 文档类型 */
  documentType?: DocumentType;
  /** 文档所有者 */
  ownerId?: string;
}

/**
 * 分享链接响应数据
 */
export interface ShareLinkResponse {
  /** 分享令牌 */
  shareToken: string;
  /** 分享链接 */
  shareUrl: string;
  /** 分享权限 */
  permission: LinkPermission;
}

/**
 * 文档版本列表响应数据
 */
export interface VersionsListResponse {
  /** 版本列表 */
  versions: DocumentVersion[];
  /** 总数 */
  total: number;
}

// ==================== 统一响应类型别名 ====================

/** 文档响应 */
export type DocumentResponse = ApiResponse<Document>;

/** 文档列表响应 */
export type DocumentsResponse = ApiResponse<DocumentsListResponse>;

/** 文档内容响应 */
export type ContentResponse = ApiResponse<DocumentContent>;

/** 文档版本响应 */
export type VersionResponse = ApiResponse<DocumentVersion>;

/** 版本列表响应 */
export type VersionsResponse = ApiResponse<VersionsListResponse>;

/** 当前权限响应 */
export type PermissionResponse = ApiResponse<CurrentPermissionResponse>;

/** 分享链接响应 */
export type ShareResponse = ApiResponse<ShareLinkResponse>;

/** 成功操作响应（无数据） */
export type SuccessResponse = ApiResponse<null>;
