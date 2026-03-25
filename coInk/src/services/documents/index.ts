/**
 * 文档管理服务 API
 *
 * 功能说明：
 * - 文档的增删改查操作
 * - 文档的星标、移动、重命名等管理功能
 * - 文档的分享链接生成与权限管理
 * - 回收站功能（软删除、恢复、永久删除）
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type {
  BatchRemovePermissionsParams,
  BatchUpsertPermissionsParams,
  CreateDocumentParams,
  Document,
  DocumentPrincipalsResponse,
  GetByParentParams,
  GetDeletedParams,
  GetPermissionParams,
  GetSharedParams,
  GetStarredParams,
  CurrentPermissionResponse,
  MoveDocumentParams,
  RecordAccessParams,
  RemoveFromRecentParams,
  RemovePermissionParams,
  RenameDocumentParams,
  SetPermissionParams,
  ShareDocumentParams,
  StarDocumentParams,
  UpdateDocumentParams,
} from './types';

import { clientRequest } from '@/services/request';
import type { ErrorHandler, RequestResult } from '@/services/request';

/**
 * 批量收藏文档
 */
const batchStarDocuments = (
  userId: string,
  documentIds: string[],
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ starred: number; requested: number }>> =>
  clientRequest.post<{ starred: number; requested: number }>('/documents/stars/batch', {
    params: { userId, documentIds },
    errorHandler,
  });

/**
 * 创建文档或文件夹
 *
 * @param params - 创建文档参数（标题、类型、所有者ID等）
 * @param errorHandler - 可选的错误处理函数
 * @returns 创建成功的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.create({
 *   title: '我的文档',
 *   type: 'FILE',
 *   ownerId: 'user_xxx',
 *   parentId: 'folder_xxx'
 * });
 * if (error) {
 *   console.error('创建失败:', error);
 *   return;
 * }
 * console.log('创建成功:', data?.data);
 * ```
 */
const create = (
  params: CreateDocumentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<Document>> =>
  clientRequest.post<Document>('/documents', {
    params,
    errorHandler,
  });

/**
 * 获取我的所有文档
 *
 * @param ownerId - 用户ID（必填）
 * @param errorHandler - 可选的错误处理函数
 * @returns 文档列表
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getMyDocuments('user_xxx');
 * if (error) {
 *   console.error('获取失败:', error);
 *   return;
 * }
 * console.log('我的文档:', data?.data?.documents);
 * ```
 */
const getMyDocuments = (
  ownerId: string,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ documents: Document[]; total: number }>> =>
  clientRequest.get<{ documents: Document[]; total: number }>('/documents', {
    params: { ownerId },
    errorHandler,
  });

/**
 * 按父目录获取文档
 *
 * @param params - 查询参数（parentId为空表示根目录）
 * @param errorHandler - 可选的错误处理函数
 * @returns 文档列表
 *
 * @example
 * ```typescript
 * // 获取根目录文档
 * const { data, error } = await documentsApi.getByParent({ ownerId: 'user_xxx' });
 *
 * // 获取指定文件夹下的文档
 * const { data, error } = await documentsApi.getByParent({
 *   ownerId: 'user_xxx',
 *   parentId: 'folder_xxx'
 * });
 * ```
 */
const getByParent = (
  params: GetByParentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ documents: Document[]; total: number }>> =>
  clientRequest.get<{ documents: Document[]; total: number }>('/documents/parent', {
    params,
    errorHandler,
  });

/**
 * 获取星标文档
 *
 * @param params - 查询参数（ownerId必填）
 * @param errorHandler - 可选的错误处理函数
 * @returns 星标文档列表
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getStarred({ ownerId: 'user_xxx' });
 * if (error) {
 *   console.error('获取失败:', error);
 *   return;
 * }
 * console.log('星标文档:', data?.data?.documents);
 * ```
 */
const getStarred = (
  params: GetStarredParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ documents: Document[]; total: number }>> => {
  const userId = params.userId ?? params.ownerId;
  return clientRequest.get<{ documents: Document[]; total: number }>('/documents/starred', {
    params: userId ? { userId } : {},
    errorHandler,
  });
};

/**
 * 获取回收站文档
 *
 * @param params - 查询参数（ownerId必填）
 * @param errorHandler - 可选的错误处理函数
 * @returns 已删除文档列表
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getDeleted({ ownerId: 'user_xxx' });
 * if (error) {
 *   console.error('获取失败:', error);
 *   return;
 * }
 * console.log('回收站文档:', data?.data?.documents);
 * ```
 */
const getDeleted = (
  params: GetDeletedParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ documents: Document[]; total: number }>> =>
  clientRequest.get<{ documents: Document[]; total: number }>('/documents/deleted', {
    params,
    errorHandler,
  });

/**
 * 获取与我共享的文档
 *
 * @param params - 查询参数（userId必填）
 * @param errorHandler - 可选的错误处理函数
 * @returns 共享文档列表
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getSharedWithMe({ userId: 'user_xxx' });
 * if (error) {
 *   console.error('获取失败:', error);
 *   return;
 * }
 * console.log('共享给我的文档:', data?.data?.documents);
 * ```
 */
const getSharedWithMe = (
  params: GetSharedParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ documents: Document[]; total: number }>> =>
  clientRequest.get<{ documents: Document[]; total: number }>('/documents/shared/me', {
    params,
    errorHandler,
  });

/**
 * 通过分享链接获取文档
 *
 * @param shareToken - 分享令牌
 * @param params - 可选查询参数（userId）
 * @param errorHandler - 可选的错误处理函数
 * @returns 文档详情
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getByShareToken('share_token_xxx');
 * if (error) {
 *   console.error('获取失败:', error);
 *   return;
 * }
 * console.log('文档详情:', data?.data);
 * ```
 */
const getByShareToken = (
  shareToken: string,
  params?: { userId?: string },
  errorHandler?: ErrorHandler,
): Promise<RequestResult<Document>> =>
  clientRequest.get<Document>(`/documents/share/${shareToken}`, {
    params,
    errorHandler,
  });

/**
 * 获取单个文档详情
 *
 * @param id - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 文档详情
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getById('doc_xxx');
 * if (error) {
 *   console.error('获取失败:', error);
 *   return;
 * }
 * console.log('文档详情:', data?.data);
 * ```
 */
const getById = (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<Document>> =>
  clientRequest.get<Document>(`/documents/${id}`, {
    errorHandler,
  });

/**
 * 记录用户打开文档（用于「最近访问」）
 */
const recordAccess = (
  id: string,
  params: RecordAccessParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ success: boolean }>> =>
  clientRequest.post<{ success: boolean }>(`/documents/${id}/access`, {
    params,
    errorHandler,
  });

/**
 * 从最近访问中批量移除（仅删除访问记录）
 */
const removeFromRecent = (
  params: RemoveFromRecentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ success: boolean; removed: number }>> =>
  clientRequest.post<{ success: boolean; removed: number }>('/documents/recent/remove', {
    params,
    errorHandler,
  });

/**
 * 更新文档
 *
 * @param id - 文档ID
 * @param params - 更新参数（标题、父文件夹、星标状态等）
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.update('doc_xxx', {
 *   title: '新标题',
 *   isStarred: true,
 *   linkPermission: 'view'
 * });
 * if (error) {
 *   console.error('更新失败:', error);
 *   return;
 * }
 * console.log('更新成功:', data?.data);
 * ```
 */
const update = (
  id: string,
  params: UpdateDocumentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<Document>> =>
  clientRequest.patch<Document>(`/documents/${id}`, {
    params,
    errorHandler,
  });

/**
 * 重命名文档
 *
 * @param id - 文档ID
 * @param params - 重命名参数（新标题）
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.rename('doc_xxx', { title: '新标题' });
 * if (error) {
 *   console.error('重命名失败:', error);
 *   return;
 * }
 * console.log('重命名成功:', data?.data);
 * ```
 */
const rename = (
  id: string,
  params: RenameDocumentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<Document>> =>
  clientRequest.patch<Document>(`/documents/${id}/rename`, {
    params,
    errorHandler,
  });

/**
 * 移动文档
 *
 * @param id - 文档ID
 * @param params - 移动参数（目标父文件夹ID、用户ID）
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.move('doc_xxx', {
 *   parentId: 'folder_xxx',
 *   userId: 'user_xxx'
 * });
 * if (error) {
 *   console.error('移动失败:', error);
 *   return;
 * }
 * console.log('移动成功:', data?.data);
 * ```
 */
const move = (
  id: string,
  params: MoveDocumentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<Document>> =>
  clientRequest.patch<Document>(`/documents/${id}/move`, {
    params,
    errorHandler,
  });

/**
 * 星标/取消星标文档
 *
 * @param id - 文档ID
 * @param params - 星标参数
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档信息
 *
 * @example
 * ```typescript
 * // 星标文档
 * const { data, error } = await documentsApi.star('doc_xxx', { isStarred: true });
 *
 * // 取消星标
 * const { data, error } = await documentsApi.star('doc_xxx', { isStarred: false });
 * ```
 */
const star = (
  id: string,
  params: StarDocumentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<Document>> =>
  clientRequest.patch<Document>(`/documents/${id}/star`, {
    params,
    errorHandler,
  });

/**
 * 软删除文档（移动到回收站）
 *
 * @param id - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.softDelete('doc_xxx');
 * if (error) {
 *   console.error('删除失败:', error);
 *   return;
 * }
 * console.log('已移动到回收站:', data?.data);
 * ```
 */
const softDelete = (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<Document>> =>
  clientRequest.patch<Document>(`/documents/${id}/soft-delete`, {
    errorHandler,
  });

/**
 * 恢复回收站文档
 *
 * @param id - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 恢复后的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.restore('doc_xxx');
 * if (error) {
 *   console.error('恢复失败:', error);
 *   return;
 * }
 * console.log('恢复成功:', data?.data);
 * ```
 */
const restore = (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<Document>> =>
  clientRequest.post<Document>(`/documents/${id}/restore`, {
    errorHandler,
  });

/**
 * 永久删除文档
 *
 * @param id - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 删除结果
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.permanentDelete('doc_xxx');
 * if (error) {
 *   console.error('删除失败:', error);
 *   return;
 * }
 * console.log('永久删除成功');
 * ```
 */
const permanentDelete = (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<null>> =>
  clientRequest.delete<null>(`/documents/${id}`, {
    errorHandler,
  });

/**
 * 生成分享链接
 *
 * @param id - 文档ID
 * @param params - 分享参数（权限）
 * @param errorHandler - 可选的错误处理函数
 * @returns 分享链接信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.share('doc_xxx', { permission: 'view' });
 * if (error) {
 *   console.error('分享失败:', error);
 *   return;
 * }
 * console.log('分享链接:', data?.data?.shareUrl);
 * ```
 */
const share = (
  id: string,
  params: ShareDocumentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ shareToken: string; shareUrl: string; permission: string }>> =>
  clientRequest.post<{ shareToken: string; shareUrl: string; permission: string }>(
    `/documents/${id}/share`,
    {
      params,
      errorHandler,
    },
  );

/**
 * 关闭分享链接
 *
 * @param id - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.closeShare('doc_xxx');
 * if (error) {
 *   console.error('关闭分享失败:', error);
 *   return;
 * }
 * console.log('分享已关闭');
 * ```
 */
const closeShare = (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<Document>> =>
  clientRequest.patch<Document>(`/documents/${id}/share`, {
    errorHandler,
  });

/**
 * 获取当前用户对文档的权限
 *
 * @param id - 文档ID
 * @param params - 查询参数（userId必填）
 * @param errorHandler - 可选的错误处理函数
 * @returns 权限信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.getCurrentPermission('doc_xxx', { userId: 'user_xxx' });
 * if (error) {
 *   console.error('获取权限失败:', error);
 *   return;
 * }
 * console.log('当前权限:', data?.data?.permission, '来源:', data?.data?.source);
 * ```
 */
const getCurrentPermission = (
  id: string,
  params: GetPermissionParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<CurrentPermissionResponse>> =>
  clientRequest.get<CurrentPermissionResponse>(`/documents/${id}/permission`, {
    params,
    errorHandler,
  });

/**
 * 设置用户权限
 *
 * @param id - 文档ID
 * @param params - 权限参数（目标用户ID、权限级别、授权者ID）
 * @param errorHandler - 可选的错误处理函数
 * @returns 设置结果
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.setPermission('doc_xxx', {
 *   targetUserId: 'user_yyy',
 *   permission: 'edit',
 *   grantedBy: 'user_xxx'
 * });
 * if (error) {
 *   console.error('设置权限失败:', error);
 *   return;
 * }
 * console.log('权限设置成功');
 * ```
 */
const setPermission = (
  id: string,
  params: SetPermissionParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<null>> =>
  clientRequest.post<null>(`/documents/${id}/permissions`, {
    params,
    errorHandler,
  });

/**
 * 移除用户权限
 *
 * @param id - 文档ID
 * @param params - 权限参数（目标用户ID、授权者ID）
 * @param errorHandler - 可选的错误处理函数
 * @returns 移除结果
 *
 * @example
 * ```typescript
 * const { data, error } = await documentsApi.removePermission('doc_xxx', {
 *   targetUserId: 'user_yyy',
 *   grantedBy: 'user_xxx'
 * });
 * if (error) {
 *   console.error('移除权限失败:', error);
 *   return;
 * }
 * console.log('权限已移除');
 * ```
 */
const removePermission = (
  id: string,
  params: RemovePermissionParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<null>> =>
  clientRequest.delete<null>(`/documents/${id}/permissions`, {
    params,
    errorHandler,
  });

/**
 * 获取文档协作者 ACL 列表（用户 + 用户组）
 */
const getPrincipals = (
  id: string,
  userId: string,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<DocumentPrincipalsResponse>> =>
  clientRequest.get<DocumentPrincipalsResponse>(`/documents/${id}/principals`, {
    params: { userId },
    errorHandler,
  });

/**
 * 批量新增/更新文档协作者权限
 */
const batchUpsertPermissions = (
  id: string,
  params: BatchUpsertPermissionsParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ success: boolean; upsertedUsers: number; upsertedGroups: number }>> =>
  clientRequest.post<{ success: boolean; upsertedUsers: number; upsertedGroups: number }>(
    `/documents/${id}/permissions/batch-upsert`,
    {
      params,
      errorHandler,
    },
  );

/**
 * 批量移除文档协作者权限
 */
const batchRemovePermissions = (
  id: string,
  params: BatchRemovePermissionsParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ success: boolean; removedUsers: number; removedGroups: number }>> =>
  clientRequest.delete<{ success: boolean; removedUsers: number; removedGroups: number }>(
    `/documents/${id}/permissions/batch`,
    {
      params,
      errorHandler,
    },
  );

export const documentsApi = {
  create,
  getMyDocuments,
  getByParent,
  getStarred,
  getDeleted,
  getSharedWithMe,
  getByShareToken,
  getById,
  recordAccess,
  removeFromRecent,
  update,
  rename,
  move,
  star,
  softDelete,
  restore,
  permanentDelete,
  share,
  closeShare,
  getCurrentPermission,
  setPermission,
  removePermission,
  getPrincipals,
  batchUpsertPermissions,
  batchRemovePermissions,
  batchStarDocuments,
};

export default documentsApi;
export * from './types';
