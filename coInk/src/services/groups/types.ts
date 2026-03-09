/**
 * 权限组服务类型定义
 *
 * 功能说明：
 * - 定义权限组相关的所有类型接口
 * - 包括权限组实体、成员信息、请求参数和响应数据
 *
 * 后端接口文档：backEnd/docs/API.md
 */

/**
 * 权限组成员信息
 */
export interface GroupMember {
  /** 用户ID */
  userId: string;
  /** 用户名称 */
  userName: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 用户邮箱 */
  email?: string;
  /** 加入时间 */
  joinedAt: string;
}

/**
 * 权限组实体
 */
export interface Group {
  /** 权限组唯一标识 */
  groupId: string;
  /** 权限组名称 */
  name: string;
  /** 所有者ID */
  ownerId: string;
  /** 所有者名称 */
  ownerName?: string;
  /** 创建时间 */
  createdAt: string;
  /** 成员数量 */
  memberCount?: number;
  /** 成员列表（仅在详情中包含） */
  members?: GroupMember[];
}

/**
 * 创建权限组请求参数
 */
export interface CreateGroupRequest {
  /** 权限组名称 */
  name: string;
  /** 所有者ID */
  ownerId: string;
}

/**
 * 更新权限组请求参数
 */
export interface UpdateGroupRequest {
  /** 新的权限组名称 */
  name: string;
  /** 操作用户ID */
  userId: string;
}

/**
 * 添加成员请求参数
 */
export interface AddMemberRequest {
  /** 目标用户ID */
  targetUserId: string;
  /** 当前操作用户ID */
  userId: string;
}

/**
 * 权限组列表响应数据
 */
export interface GroupsListResponse {
  /** 权限组列表 */
  groups: Group[];
  /** 总数 */
  total: number;
}

/**
 * 权限组成员列表响应数据
 */
export interface GroupMembersResponse {
  /** 成员列表 */
  members: GroupMember[];
  /** 总数 */
  total: number;
}
