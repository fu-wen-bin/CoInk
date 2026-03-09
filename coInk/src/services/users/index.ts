/**
 * 用户服务 API
 *
 * 功能说明：
 * - 用户信息查询（根据ID获取）
 * - 用户创建、更新、删除（管理员功能）
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type {
  CreateUserRequest,
  DeleteUserRequest,
  GetUserInfoRequest,
  UpdateUserRequest,
  UserResponse,
} from './types';

import { clientRequest, ErrorHandler } from '@/services/request';
import type { RequestResult } from '@/services/request';

/**
 * 用户服务 API 对象
 * 提供用户相关的所有后端接口调用
 */
export const UserApi = {
  /**
   * 获取用户信息
   * 根据用户ID获取用户的详细信息
   *
   * @param params - 包含 userId 的请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 用户详细信息
   *
   * @example
   * ```typescript
   * const { data, error } = await UserApi.getUserInfo({ userId: 'user_xxx' });
   * if (error) {
   *   console.error('获取用户信息失败:', error);
   *   return;
   * }
   * console.log('用户信息:', data?.data?.user);
   * ```
   */
  getUserInfo: (
    params: GetUserInfoRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<UserResponse>> =>
    clientRequest.get<UserResponse>('/user/info', {
      params,
      errorHandler,
    }),

  /**
   * 创建用户
   * 管理员创建新用户账号
   *
   * @param data - 创建用户参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 创建成功的用户信息
   *
   * @example
   * ```typescript
   * const { data, error } = await UserApi.createUser({
   *   name: '张三',
   *   email: 'zhangsan@example.com',
   *   password: 'securePassword123',
   *   role: 'user'
   * });
   * if (error) {
   *   console.error('创建用户失败:', error);
   *   return;
   * }
   * console.log('用户创建成功:', data?.data?.user);
   * ```
   */
  createUser: (
    data: CreateUserRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<UserResponse>> =>
    clientRequest.post<UserResponse>('/user/create', {
      params: data,
      errorHandler,
    }),

  /**
   * 更新用户
   * 更新指定用户的信息
   *
   * @param data - 更新用户参数（必须包含 userId）
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的用户信息
   *
   * @example
   * ```typescript
   * const { data, error } = await UserApi.updateUser({
   *   userId: 'user_xxx',
   *   name: '新名字',
   *   bio: '新简介'
   * });
   * if (error) {
   *   console.error('更新用户失败:', error);
   *   return;
   * }
   * console.log('用户更新成功:', data?.data?.user);
   * ```
   */
  updateUser: (
    data: UpdateUserRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<UserResponse>> =>
    clientRequest.post<UserResponse>('/user/update', {
      params: data,
      errorHandler,
    }),

  /**
   * 删除用户
   * 删除指定用户账号（管理员功能）
   *
   * @param data - 删除用户参数（必须包含 userId）
   * @param errorHandler - 可选的错误处理函数
   * @returns 删除结果
   *
   * @example
   * ```typescript
   * const { data, error } = await UserApi.deleteUser({ userId: 'user_xxx' });
   * if (error) {
   *   console.error('删除用户失败:', error);
   *   return;
   * }
   * console.log('用户删除成功');
   * ```
   */
  deleteUser: (
    data: DeleteUserRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<void>> =>
    clientRequest.post<void>('/user/delete', {
      params: data,
      errorHandler,
    }),
};

/**
 * 默认导出用户API
 */
export default UserApi;

/**
 * 导出所有类型定义
 */
export * from './types';
