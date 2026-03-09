/**
 * 文档版本服务 API
 *
 * 功能说明：
 * - 获取文档的所有历史版本
 * - 创建文档版本（手动保存版本）
 * - 获取指定版本的详情
 * - 恢复到指定版本
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type { DocumentVersion, CreateVersionParams } from './types';

import { clientRequest } from '@/services/request';
import type { ErrorHandler, RequestResult } from '@/services/request';

/**
 * 获取文档所有版本
 *
 * @param documentId - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 版本列表（按时间倒序排列）
 *
 * @example
 * ```typescript
 * const { data, error } = await documentVersionApi.getVersions('doc_xxx');
 * if (error) {
 *   console.error('获取版本列表失败:', error);
 *   return;
 * }
 * console.log('版本列表:', data?.data?.versions);
 * console.log('版本总数:', data?.data?.total);
 * ```
 */
const getVersions = (
  documentId: string,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<{ versions: DocumentVersion[]; total: number }>> =>
  clientRequest.get<{ versions: DocumentVersion[]; total: number }>(
    `/documents/${documentId}/versions`,
    {
      errorHandler,
    },
  );

/**
 * 创建文档版本
 *
 * @param documentId - 文档ID
 * @param params - 版本参数（版本标题、内容、用户ID）
 * @param errorHandler - 可选的错误处理函数
 * @returns 创建的版本信息
 *
 * @example
 * ```typescript
 * const { data, error } = await documentVersionApi.createVersion('doc_xxx', {
 *   title: '版本 1.0 - 初稿完成',
 *   content: {
 *     type: 'doc',
 *     content: [
 *       {
 *         type: 'paragraph',
 *         content: [{ type: 'text', text: '文档内容...' }]
 *       }
 *     ]
 *   },
 *   userId: 'user_xxx'
 * });
 * if (error) {
 *   console.error('创建版本失败:', error);
 *   return;
 * }
 * console.log('版本创建成功:', data?.data);
 * ```
 */
const createVersion = (
  documentId: string,
  params: CreateVersionParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<DocumentVersion>> =>
  clientRequest.post<DocumentVersion>(`/documents/${documentId}/versions`, {
    params,
    errorHandler,
  });

/**
 * 获取指定版本详情
 *
 * @param documentId - 文档ID
 * @param versionId - 版本ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 版本详情（包含完整内容）
 *
 * @example
 * ```typescript
 * const { data, error } = await documentVersionApi.getVersionById('doc_xxx', 'version_yyy');
 * if (error) {
 *   console.error('获取版本详情失败:', error);
 *   return;
 * }
 * console.log('版本标题:', data?.data?.title);
 * console.log('版本内容:', data?.data?.content);
 * console.log('创建者:', data?.data?.user?.name);
 * console.log('创建时间:', data?.data?.createdAt);
 * ```
 */
const getVersionById = (
  documentId: string,
  versionId: string,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<DocumentVersion>> =>
  clientRequest.get<DocumentVersion>(`/documents/${documentId}/versions/${versionId}`, {
    errorHandler,
  });

/**
 * 恢复到指定版本
 *
 * @param documentId - 文档ID
 * @param versionId - 版本ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 恢复结果
 *
 * @example
 * ```typescript
 * const { data, error } = await documentVersionApi.restoreVersion('doc_xxx', 'version_yyy');
 * if (error) {
 *   console.error('恢复版本失败:', error);
 *   return;
 * }
 * console.log('版本恢复成功');
 * // 恢复后，当前文档内容将被替换为指定版本的内容
 * ```
 */
const restoreVersion = (
  documentId: string,
  versionId: string,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<null>> =>
  clientRequest.post<null>(`/documents/${documentId}/versions/${versionId}/restore`, {
    errorHandler,
  });

/**
 * 文档版本管理 API 对象
 */
export const documentVersionApi = {
  /** 获取文档所有版本 */
  getVersions,
  /** 创建文档版本 */
  createVersion,
  /** 获取指定版本详情 */
  getVersionById,
  /** 恢复到指定版本 */
  restoreVersion,
};

/** 默认导出 */
export default documentVersionApi;
