import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, ReplyCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建评论
   */
  async create(
    documentId: string,
    userId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    // 检查文档是否存在
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc || doc.is_deleted) {
      throw new NotFoundException('文档不存在');
    }

    const commentId = nanoid();

    await this.prisma.document_comments.create({
      data: {
        comment_id: commentId,
        document_id: documentId,
        user_id: userId,
        content: createCommentDto.content,
        position: createCommentDto.position
          ? (createCommentDto.position as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        parent_id: null,
        is_resolved: false,
      },
    });

    return this.findOne(commentId);
  }

  /**
   * 回复评论
   */
  async reply(
    documentId: string,
    parentId: string,
    userId: string,
    replyDto: ReplyCommentDto,
  ): Promise<Comment> {
    // 检查父评论是否存在
    const parentComment = await this.prisma.document_comments.findUnique({
      where: { comment_id: parentId },
    });

    if (!parentComment) {
      throw new NotFoundException('父评论不存在');
    }

    if (parentComment.document_id !== documentId) {
      throw new BadRequestException('评论不属于该文档');
    }

    // 检查父评论是否已经是回复（限制嵌套层级为2）
    if (parentComment.parent_id) {
      throw new BadRequestException('不支持回复的回复');
    }

    const commentId = nanoid();

    await this.prisma.document_comments.create({
      data: {
        comment_id: commentId,
        document_id: documentId,
        user_id: userId,
        content: replyDto.content,
        parent_id: parentId,
        is_resolved: false,
      },
    });

    return this.findOne(commentId);
  }

  /**
   * 获取文档的所有评论（树形结构）
   */
  async findByDocument(documentId: string): Promise<Comment[]> {
    // 检查文档是否存在
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 获取所有顶级评论
    const topLevelComments = await this.prisma.document_comments.findMany({
      where: {
        document_id: documentId,
        parent_id: null,
      },
      orderBy: { created_at: 'desc' },
    });

    // 获取所有回复
    const replies = await this.prisma.document_comments.findMany({
      where: {
        document_id: documentId,
        parent_id: { not: null },
      },
      orderBy: { created_at: 'asc' },
    });

    // 获取所有相关用户
    const userIds = new Set([
      ...topLevelComments.map(c => c.user_id),
      ...replies.map(r => r.user_id),
    ]);

    const users = await this.prisma.users.findMany({
      where: { user_id: { in: Array.from(userIds) } },
      select: {
        user_id: true,
        name: true,
        avatar_url: true,
      },
    });

    const userMap = new Map(users.map(u => [u.user_id, u]));

    // 构建树形结构
    return topLevelComments.map((comment) => {
      const commentReplies = replies
        .filter((r) => r.parent_id === comment.comment_id)
        .map((r) => this.mapToComment(r, userMap.get(r.user_id)));

      return {
        ...this.mapToComment(comment, userMap.get(comment.user_id)),
        replies: commentReplies,
        replyCount: commentReplies.length,
      };
    });
  }

  /**
   * 获取评论详情
   */
  async findOne(commentId: string): Promise<Comment> {
    const comment = await this.prisma.document_comments.findUnique({
      where: { comment_id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    const user = await this.prisma.users.findUnique({
      where: { user_id: comment.user_id },
      select: {
        user_id: true,
        name: true,
        avatar_url: true,
      },
    });

    return this.mapToComment(comment, user ?? undefined);
  }

  /**
   * 更新评论
   */
  async update(
    commentId: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.prisma.document_comments.findUnique({
      where: { comment_id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 只能更新自己的评论
    if (comment.user_id !== userId) {
      throw new ForbiddenException('没有权限更新此评论');
    }

    const updateData: Prisma.document_commentsUpdateInput = {
      updated_at: new Date(),
    };

    if (updateCommentDto.content !== undefined) {
      updateData.content = updateCommentDto.content;
    }

    if (updateCommentDto.position !== undefined) {
      updateData.position = updateCommentDto.position as unknown as Prisma.InputJsonValue;
    }

    await this.prisma.document_comments.update({
      where: { comment_id: commentId },
      data: updateData,
    });

    return this.findOne(commentId);
  }

  /**
   * 删除评论
   */
  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.document_comments.findUnique({
      where: { comment_id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 检查权限（只能删除自己的评论，或者是文档所有者）
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: comment.document_id },
      select: { owner_id: true },
    });

    if (comment.user_id !== userId && doc?.owner_id !== userId) {
      throw new ForbiddenException('没有权限删除此评论');
    }

    // 如果是顶级评论，同时删除所有回复
    if (!comment.parent_id) {
      await this.prisma.document_comments.deleteMany({
        where: { parent_id: commentId },
      });
    }

    await this.prisma.document_comments.delete({
      where: { comment_id: commentId },
    });
  }

  /**
   * 解决评论
   */
  async resolve(commentId: string, userId: string): Promise<Comment> {
    const comment = await this.prisma.document_comments.findUnique({
      where: { comment_id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 检查权限（文档所有者或有编辑权限的用户）
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: comment.document_id },
      select: { owner_id: true },
    });

    // 评论作者、文档所有者都可以解决评论
    if (comment.user_id !== userId && doc?.owner_id !== userId) {
      throw new ForbiddenException('没有权限解决此评论');
    }

    await this.prisma.document_comments.update({
      where: { comment_id: commentId },
      data: {
        is_resolved: true,
        resolved_by: userId,
        resolved_at: new Date(),
        updated_at: new Date(),
      },
    });

    return this.findOne(commentId);
  }

  /**
   * 取消解决评论
   */
  async unresolve(commentId: string, userId: string): Promise<Comment> {
    const comment = await this.prisma.document_comments.findUnique({
      where: { comment_id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 检查权限（只有解决者或文档所有者可以取消解决）
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: comment.document_id },
      select: { owner_id: true },
    });

    if (comment.resolved_by !== userId && doc?.owner_id !== userId) {
      throw new ForbiddenException('没有权限取消解决此评论');
    }

    await this.prisma.document_comments.update({
      where: { comment_id: commentId },
      data: {
        is_resolved: false,
        resolved_by: null,
        resolved_at: null,
        updated_at: new Date(),
      },
    });

    return this.findOne(commentId);
  }

  /**
   * 映射数据库模型到实体
   */
  private mapToComment(
    comment: {
      comment_id: string;
      document_id: string;
      user_id: string;
      content: string;
      parent_id: string | null;
      position: Prisma.JsonValue;
      is_resolved: boolean;
      resolved_by: string | null;
      resolved_at: Date | null;
      created_at: Date;
      updated_at: Date;
    },
    user?: {
      user_id: string;
      name: string;
      avatar_url: string | null;
    },
    replies?: Comment[],
  ): Comment {
    return {
      commentId: comment.comment_id,
      documentId: comment.document_id,
      userId: comment.user_id,
      user: user
        ? {
            userId: user.user_id,
            name: user.name,
            avatarUrl: user.avatar_url ?? undefined,
          }
        : undefined,
      content: comment.content,
      parentId: comment.parent_id ?? undefined,
      position: comment.position as unknown as Comment['position'],
      isResolved: comment.is_resolved,
      resolvedBy: comment.resolved_by ?? undefined,
      resolvedAt: comment.resolved_at ?? undefined,
      replies,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }
}
