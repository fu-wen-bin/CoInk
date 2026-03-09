/**
 * 文档内容服务 API
 *
 * 功能说明：
 * - 获取文档内容（TipTap JSON 格式）
 * - 创建文档内容
 * - 更新文档内容
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type { DocumentContent, CreateContentParams, UpdateContentParams } from './types';

import { clientRequest } from '@/services/request';
import type { ErrorHandler, RequestResult } from '@/services/request';

/**
 * 获取文档内容
 *
 * @param documentId - 文档ID
 * @param errorHandler - 可选的错误处理函数
 * @returns 文档内容（包含 TipTap JSON 格式内容）
 *
 * @example
 * ```typescript
 * const { data, error } = await documentContentApi.getContent('doc_xxx');
 * if (error) {
 *   console.error('获取内容失败:', error);
 *   return;
 * }
 * console.log('文档内容:', data?.data?.content);
 * console.log('最后更新者:', data?.data?.updatedBy);
 * console.log('更新时间:', data?.data?.updatedAt);
 * ```
 */
const getContent = (
  documentId: string,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<DocumentContent>> =>
  clientRequest.get<DocumentContent>(`/documents/${documentId}/content`, {
    errorHandler,
  });

/**
 * 创建文档内容
 *
 * @param documentId - 文档ID
 * @param params - 内容参数（TipTap JSON 内容、更新者ID）
 * @param errorHandler - 可选的错误处理函数
 * @returns 创建的文档内容
 *
 * @example
 * ```typescript
 * const { data, error } = await documentContentApi.createContent('doc_xxx', {
 *   content: {
 *     type: 'doc',
 *     content: [
 *       {
 *         type: 'paragraph',
 *         content: [{ type: 'text', text: 'Hello World' }]
 *       }
 *     ]
 *   },
 *   updatedBy: 'user_xxx'
 * });
 * if (error) {
 *   console.error('创建内容失败:', error);
 *   return;
 * }
 * console.log('内容创建成功:', data?.data);
 * ```
 */
const createContent = (
  documentId: string,
  params: CreateContentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<DocumentContent>> =>
  clientRequest.post<DocumentContent>(`/documents/${documentId}/content`, {
    params,
    errorHandler,
  });

/**
 * 更新文档内容
 *
 * @param documentId - 文档ID
 * @param params - 内容参数（TipTap JSON 内容、更新者ID）
 * @param errorHandler - 可选的错误处理函数
 * @returns 更新后的文档内容
 *
 * @example
 * ```typescript
 * const { data, error } = await documentContentApi.updateContent('doc_xxx', {
 *   content: {
 *     type: 'doc',
 *     content: [
 *       {
 *         type: 'heading',
 *         attrs: { level: 1 },
 *         content: [{ type: 'text', text: '新标题' }]
 *       },
 *       {
 *         type: 'paragraph',
 *         content: [{ type: 'text', text: '新内容' }]
 *       }
 *     ]
 *   },
 *   updatedBy: 'user_xxx'
 * });
 * if (error) {
 *   console.error('更新内容失败:', error);
 *   return;
 * }
 * console.log('内容更新成功:', data?.data);
 * ```
 */
const updateContent = (
  documentId: string,
  params: UpdateContentParams,
  errorHandler?: ErrorHandler,
): Promise<RequestResult<DocumentContent>> =>
  clientRequest.patch<DocumentContent>(`/documents/${documentId}/content`, {
    params,
    errorHandler,
  });

/**
 * 文档内容管理 API 对象
 */
export const documentContentApi = {
  /** 获取文档内容 */
  getContent,
  /** 创建文档内容 */
  createContent,
  /** 更新文档内容 */
  updateContent,
};

/** 默认导出 */
export default documentContentApi;
