/**
 * 评论服务类型定义
 *
 * 功能说明：
 * - 定义评论相关的所有类型接口
 * - 包括评论实体、位置信息、请求参数和响应数据
 *
 * 后端接口文档：backEnd/docs/API.md
 */

/**
 * 评论位置信息
 * 用于定位评论在文档中的具体位置
 */
export interface CommentPosition {
  /** 块ID，标识评论关联的文档块 */
  blockId: string;
  /** 偏移量，标识在块内的具体位置 */
  offset: number;
}

/**
 * 评论实体
 * 表示文档中的一条评论或回复
 */
export interface Comment {
  /** 评论唯一标识 */
  commentId: string;
  /** 所属文档ID */
  documentId: string;
  /** 评论作者ID */
  userId: string;
  /** 评论作者名称 */
  userName?: string;
  /** 评论作者头像 */
  userAvatar?: string;
  /** 评论内容 */
  content: string;
  /** 父评论ID，用于嵌套回复 */
  parentId: string | null;
  /** 文档位置信息 */
  position: CommentPosition | null;
  /** 是否已解决 */
  isResolved: boolean;
  /** 解决者ID */
  resolvedBy: string | null;
  /** 解决时间 */
  resolvedAt: string | null;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 子回复列表 */
  replies?: Comment[];
}

/**
 * 创建评论请求参数
 */
export interface CreateCommentRequest {
  /** 评论内容 */
  content: string;
  /** 文档位置信息 */
  position: CommentPosition;
  /** 用户ID */
  userId: string;
}

/**
 * 回复评论请求参数
 */
export interface ReplyCommentRequest {
  /** 回复内容 */
  content: string;
  /** 用户ID */
  userId: string;
}

/**
 * 更新评论请求参数
 */
export interface UpdateCommentRequest {
  /** 新的评论内容 */
  content: string;
  /** 用户ID */
  userId: string;
}

/**
 * 解决/取消解决评论请求参数
 */
export interface ResolveCommentRequest {
  /** 操作用户ID */
  userId: string;
}

/**
 * 获取评论列表响应数据
 */
export interface GetCommentsResponse {
  /** 评论列表 */
  comments: Comment[];
  /** 总数 */
  total: number;
}

/**
 * 获取评论详情响应数据
 */
export interface GetCommentDetailResponse {
  /** 评论详情 */
  comment: Comment;
  /** 回复列表 */
  replies: Comment[];
}
