/**
 * 评论服务 API
 *
 * 功能说明：
 * - 创建文档评论
 * - 获取文档评论列表
 * - 回复评论
 * - 更新和删除评论
 * - 解决/取消解决评论
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type {
  Comment,
  CreateCommentRequest,
  ReplyCommentRequest,
  UpdateCommentRequest,
  ResolveCommentRequest,
  GetCommentsResponse,
  GetCommentDetailResponse,
} from './types';

import { clientRequest, ErrorHandler } from '@/services/request';
import type { RequestResult } from '@/services/request';

/**
 * 评论服务 API 对象
 *
 * @example
 * ```typescript
 * import { commentsApi } from '@/services/comments';
 *
 * // 创建评论
 * const { data, error } = await commentsApi.createComment('doc_id', {
 *   content: '这是一条评论',
 *   position: { blockId: 'block_1', offset: 0 },
 *   userId: 'user_id'
 * });
 *
 * if (error) {
 *   console.error('创建失败:', error);
 *   return;
 * }
 *
 * console.log('评论创建成功:', data?.data);
 * ```
 */
export const commentsApi = {
  /**
   * 创建评论
   *
   * 在指定文档中创建一条新评论
   *
   * @param documentId - 文档ID
   * @param params - 创建评论请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 创建的评论详情
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.createComment('doc_id', {
   *   content: '这是一条评论',
   *   position: { blockId: 'block_1', offset: 0 },
   *   userId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 使用 data.data
   * ```
   */
  createComment: (
    documentId: string,
    params: CreateCommentRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Comment>> =>
    clientRequest.post<Comment>(`/documents/${documentId}/comments`, {
      params,
      errorHandler,
    }),

  /**
   * 获取文档的所有评论
   *
   * 获取指定文档的评论列表，包括所有回复
   *
   * @param documentId - 文档ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 评论列表和总数
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.getDocumentComments('doc_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // data.data.comments 为评论列表
   * // data.data.total 为评论总数
   * ```
   */
  getDocumentComments: (
    documentId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<GetCommentsResponse>> =>
    clientRequest.get<GetCommentsResponse>(`/documents/${documentId}/comments`, {
      errorHandler,
    }),

  /**
   * 回复评论
   *
   * 对指定评论进行回复
   *
   * @param documentId - 文档ID
   * @param commentId - 被回复的评论ID
   * @param params - 回复请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 创建的回复评论
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.replyToComment('doc_id', 'comment_id', {
   *   content: '这是一条回复',
   *   userId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 使用 data.data
   * ```
   */
  replyToComment: (
    documentId: string,
    commentId: string,
    params: ReplyCommentRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Comment>> =>
    clientRequest.post<Comment>(`/documents/${documentId}/comments/${commentId}/reply`, {
      params,
      errorHandler,
    }),

  /**
   * 获取评论详情
   *
   * 获取单条评论的详细信息，包括其所有回复
   *
   * @param commentId - 评论ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 评论详情和回复列表
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.getCommentDetail('comment_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // data.data.comment 为评论详情
   * // data.data.replies 为回复列表
   * ```
   */
  getCommentDetail: (
    commentId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<GetCommentDetailResponse>> =>
    clientRequest.get<GetCommentDetailResponse>(`/comments/${commentId}`, {
      errorHandler,
    }),

  /**
   * 更新评论
   *
   * 更新指定评论的内容
   *
   * @param commentId - 评论ID
   * @param params - 更新请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的评论
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.updateComment('comment_id', {
   *   content: '更新后的内容',
   *   userId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 使用 data.data
   * ```
   */
  updateComment: (
    commentId: string,
    params: UpdateCommentRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Comment>> =>
    clientRequest.patch<Comment>(`/comments/${commentId}`, {
      params,
      errorHandler,
    }),

  /**
   * 删除评论
   *
   * 删除指定评论及其所有回复
   *
   * @param commentId - 评论ID
   * @param userId - 操作用户ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 删除结果
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.deleteComment('comment_id', 'user_id');
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // 删除成功
   * ```
   */
  deleteComment: (
    commentId: string,
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<void>> =>
    clientRequest.delete<void>(`/comments/${commentId}`, {
      params: { userId },
      errorHandler,
    }),

  /**
   * 解决评论
   *
   * 将评论标记为已解决
   *
   * @param commentId - 评论ID
   * @param params - 解决请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的评论
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.resolveComment('comment_id', {
   *   userId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // data.data.isResolved 为 true
   * ```
   */
  resolveComment: (
    commentId: string,
    params: ResolveCommentRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Comment>> =>
    clientRequest.patch<Comment>(`/comments/${commentId}/resolve`, {
      params,
      errorHandler,
    }),

  /**
   * 取消解决评论
   *
   * 将评论标记为未解决
   *
   * @param commentId - 评论ID
   * @param params - 取消解决请求参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的评论
   *
   * @example
   * ```typescript
   * const { data, error } = await commentsApi.unresolveComment('comment_id', {
   *   userId: 'user_id'
   * });
   * if (error) {
   *   console.error(error);
   *   return;
   * }
   * // data.data.isResolved 为 false
   * ```
   */
  unresolveComment: (
    commentId: string,
    params: ResolveCommentRequest,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Comment>> =>
    clientRequest.patch<Comment>(`/comments/${commentId}/unresolve`, {
      params,
      errorHandler,
    }),
};

/**
 * 默认导出评论服务 API
 */
export default commentsApi;

/**
 * 导出所有类型定义
 */
export * from './types';
