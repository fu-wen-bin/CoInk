import type {
  CommentReply,
  CommentThread,
  CreateCommentRequest,
  CreateReplyRequest,
  DeleteCommentRequest,
  DeleteReplyRequest,
  UpdateCommentRequest,
} from './type';

import { commentsApi } from '@/services/comments';
import type { Comment as BackendComment } from '@/services/comments/types';
import { getCurrentUserId } from '@/utils';

/** 后端序列化时可能带嵌套 `user`（与 `services/comments` 静态类型略有差异） */
type ApiComment = BackendComment & {
  user?: { userId: string; name: string; avatarUrl?: string };
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * 将后端单条评论（含嵌套 replies）转为面板使用的 CommentThread
 */
function mapBackendRootToThread(root: ApiComment): CommentThread {
  const userName = (root as { userName?: string }).userName ?? root.user?.name ?? '用户';
  const userAvatar = (root as { userAvatar?: string }).userAvatar ?? root.user?.avatarUrl;

  const pos = root.position as { blockId?: string; text?: string } | null | undefined;
  const markId = pos?.blockId?.trim() ? pos.blockId : root.commentId;

  const mainReply: CommentReply = {
    id: root.commentId,
    threadId: root.commentId,
    content: root.content,
    createdAt: toIso(root.createdAt),
    userId: root.userId,
    userName,
    userAvatar,
  };

  const childReplies: CommentReply[] = (root.replies ?? []).map((r: ApiComment) => ({
    id: r.commentId,
    threadId: root.commentId,
    content: r.content,
    createdAt: toIso(r.createdAt),
    userId: r.userId,
    userName: (r as { userName?: string }).userName ?? r.user?.name ?? '用户',
    userAvatar: (r as { userAvatar?: string }).userAvatar ?? r.user?.avatarUrl,
  }));

  return {
    id: root.commentId,
    documentId: root.documentId,
    commentId: markId,
    text: typeof pos?.text === 'string' ? pos.text : '',
    createdAt: toIso(root.createdAt),
    updatedAt: toIso(root.updatedAt),
    userId: root.userId,
    userName,
    userAvatar,
    resolved: root.isResolved,
    replies: [mainReply, ...childReplies],
  };
}

/**
 * 评论服务 API（与 Nest `documents/:documentId/comments` 路由对齐）
 */
class CommentApi {
  /**
   * 获取文档的所有评论
   */
  async getComments(documentId: string): Promise<CommentThread[]> {
    const { data, error } = await commentsApi.getDocumentComments(documentId);

    if (error || data?.data === undefined || data?.data === null) {
      console.error('获取评论失败:', error);

      return [];
    }

    const payload = data.data;
    const roots: ApiComment[] = Array.isArray(payload)
      ? (payload as ApiComment[])
      : Array.isArray((payload as { comments?: ApiComment[] }).comments)
        ? (payload as { comments: ApiComment[] }).comments
        : [];

    return roots.map(mapBackendRootToThread);
  }

  /**
   * 创建评论
   */
  async createComment(data: CreateCommentRequest): Promise<CommentThread> {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('未登录，无法创建评论');
    }

    const { data: response, error } = await commentsApi.createComment(data.documentId, {
      content: data.content,
      userId,
      position: { blockId: data.commentId, offset: 0 },
    });

    if (error || !response?.data) {
      throw new Error(error || '创建评论失败');
    }

    const created = response.data as ApiComment;
    const withReplies: ApiComment = { ...created, replies: [] };

    const thread = mapBackendRootToThread(withReplies);

    return { ...thread, text: data.text };
  }

  /**
   * 更新评论（标记为已解决）
   */
  async updateComment(data: UpdateCommentRequest): Promise<CommentThread> {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('未登录');
    }

    const { data: response, error } = await commentsApi.resolveComment(data.id, {
      userId,
    });

    if (error || !response?.data) {
      throw new Error(error || '更新评论失败');
    }

    const updated = response.data as ApiComment;
    const withReplies: ApiComment = { ...updated, replies: updated.replies ?? [] };

    return mapBackendRootToThread(withReplies);
  }

  /**
   * 删除评论（整条线程）
   */
  async deleteComment(data: DeleteCommentRequest): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('未登录');
    }

    const { error } = await commentsApi.deleteComment(data.id, userId);

    if (error) {
      throw new Error(error);
    }
  }

  /**
   * 创建回复
   */
  async createReply(data: CreateReplyRequest): Promise<CommentReply> {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('未登录');
    }

    const { data: response, error } = await commentsApi.replyToComment(
      data.documentId,
      data.threadId,
      {
        content: data.content,
        userId,
      },
    );

    if (error || !response?.data) {
      throw new Error(error || '创建回复失败');
    }

    const r = response.data as ApiComment;

    return {
      id: r.commentId,
      threadId: data.threadId,
      content: r.content,
      createdAt: toIso(r.createdAt),
      userId: r.userId,
      userName: r.user?.name ?? '用户',
      userAvatar: r.user?.avatarUrl,
    };
  }

  /**
   * 删除回复
   */
  async deleteReply(data: DeleteReplyRequest): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('未登录');
    }

    const { error } = await commentsApi.deleteComment(data.id, userId);

    if (error) {
      throw new Error(error);
    }
  }
}

export default new CommentApi();
