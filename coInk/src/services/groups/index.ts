/**
 * 权限组服务 API
 *
 * 功能说明：
 * - 创建、更新、删除权限组
 * - 获取我拥有的权限组
 * - 管理权限组成员（添加、移除）
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type {
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
  AddMemberRequest,
  GroupsListResponse,
  GroupMembersResponse,
} from './types';

import { clientRequest, ErrorHandler } from '@/services/request';
import type { RequestResult } from '@/services/request';

const normalizeGroupsList = (payload: unknown): GroupsListResponse => {
  if (Array.isArray(payload)) {
    return {
      groups: payload as Group[],
      total: payload.length,
    };
  }

  if (payload && typeof payload === 'object') {
    const maybe = payload as Partial<GroupsListResponse>;
    if (Array.isArray(maybe.groups)) {
      return {
        groups: maybe.groups,
        total: typeof maybe.total === 'number' ? maybe.total : maybe.groups.length,
      };
    }
  }

  return {
    groups: [],
    total: 0,
  };
};

/**
 * 权限组服务 API 对象
 *
 * @example
 * ```typescript
 * import { groupsApi } from '@/services/groups';
 *
 * // 创建权限组
 * const { data, error } = await groupsApi.createGroup({
 *   name: '研发团队',
 *   ownerId: 'user_id'
 * });
 *
 * if (error) {
 *   console.error('创建失败:', error);
 *   return;
 * }
 *
 * console.log('权限组创建成功:', data?.data);
 * ```
 */
export const groupsApi = {
  /**
   * 创建权限组
   *
   * 创建一个新的权限组
   *
   * @param params - 创建权限组请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 创建的权限组详情
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.createGroup({
   *   name: '研发团队',
   *   ownerId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 使用 data.data
   * ```
   */
  createGroup: (
    params: CreateGroupRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Group>> =>
    clientRequest.post<Group>('/groups', {
      params,
      errorHandler,
    }),

  /**
   * 获取我拥有的权限组
   *
   * 获取当前用户作为所有者创建的所有权限组
   *
   * @param userId - 用户ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 权限组列表
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.getOwnedGroups('user_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // data.data.groups 为权限组列表
   * ```
   */
  getOwnedGroups: (
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<GroupsListResponse>> =>
    (async () => {
      const response = await clientRequest.get<GroupsListResponse | Group[]>('/groups/owned', {
        params: { userId },
        errorHandler,
      });

      return {
        ...response,
        data: response.data
          ? {
              ...response.data,
              data: normalizeGroupsList(response.data.data),
            }
          : null,
      };
    })(),

  /**
   * 获取权限组详情
   *
   * 获取指定权限组的详细信息
   *
   * @param groupId - 权限组ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 权限组详情
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.getGroupDetail('group_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 使用 data.data
   * ```
   */
  getGroupDetail: (groupId: string, errorHandler?: ErrorHandler): Promise<RequestResult<Group>> =>
    clientRequest.get<Group>(`/groups/${groupId}`, {
      errorHandler,
    }),

  /**
   * 更新权限组
   *
   * 更新指定权限组的信息
   *
   * @param groupId - 权限组ID
   * @param params - 更新请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的权限组
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.updateGroup('group_id', {
   *   name: '新的组名',
   *   userId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 使用 data.data
   * ```
   */
  updateGroup: (
    groupId: string,
    params: UpdateGroupRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Group>> =>
    clientRequest.patch<Group>(`/groups/${groupId}`, {
      params,
      errorHandler,
    }),

  /**
   * 删除权限组
   *
   * 删除指定的权限组
   *
   * @param groupId - 权限组ID
   * @param userId - 操作用户ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 删除结果
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.deleteGroup('group_id', 'user_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 删除成功
   * ```
   */
  deleteGroup: (
    groupId: string,
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<void>> =>
    clientRequest.delete<void>(`/groups/${groupId}`, {
      params: { userId },
      errorHandler,
    }),

  /**
   * 获取权限组成员列表
   *
   * 获取指定权限组的所有成员
   *
   * @param groupId - 权限组ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 成员列表
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.getGroupMembers('group_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // data.data.members 为成员列表
   * ```
   */
  getGroupMembers: (
    groupId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<GroupMembersResponse>> =>
    clientRequest.get<GroupMembersResponse>(`/groups/${groupId}/members`, {
      errorHandler,
    }),

  /**
   * 添加成员到权限组
   *
   * 将指定用户添加到权限组
   *
   * @param groupId - 权限组ID
   * @param params - 添加成员请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 添加结果
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.addMember('group_id', {
   *   targetUserId: 'target_user_id',
   *   userId: 'current_user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 添加成功
   * ```
   */
  addMember: (
    groupId: string,
    params: AddMemberRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<void>> =>
    clientRequest.post<void>(`/groups/${groupId}/members`, {
      params,
      errorHandler,
    }),

  /**
   * 从权限组移除成员
   *
   * 将指定用户从权限组中移除
   *
   * @param groupId - 权限组ID
   * @param targetUserId - 目标用户ID
   * @param userId - 当前操作用户ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 移除结果
   *
   * @example
   * ```typescript
   * const { data, error } = await groupsApi.removeMember('group_id', 'target_user_id', 'user_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 移除成功
   * ```
   */
  removeMember: (
    groupId: string,
    targetUserId: string,
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<void>> =>
    clientRequest.delete<void>(`/groups/${groupId}/members/${targetUserId}`, {
      params: { userId },
      errorHandler,
    }),
};

/**
 * 默认导出权限组服务 API
 */
export default groupsApi;

/**
 * 导出所有类型定义
 */
export * from './types';
