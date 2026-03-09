import { CommentPosition } from '../dto/create-comment.dto';

/**
 * 评论实体
 */
export class Comment {
  commentId: string;
  documentId: string;
  userId: string;
  user?: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
  content: string;
  parentId?: string;
  position?: CommentPosition;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  replies?: Comment[];
  replyCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
