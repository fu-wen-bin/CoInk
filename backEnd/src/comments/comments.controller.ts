import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CommentsService } from './comments.service';
import { CreateCommentDto, ReplyCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('documents/:documentId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * 创建评论
   */
  @Post()
  create(
    @Param('documentId') documentId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Body('userId') userId: string,
  ) {
    return this.commentsService.create(documentId, userId, createCommentDto);
  }

  /**
   * 获取文档的所有评论
   */
  @Get()
  findByDocument(@Param('documentId') documentId: string) {
    return this.commentsService.findByDocument(documentId);
  }

  /**
   * 回复评论
   */
  @Post(':commentId/reply')
  reply(
    @Param('documentId') documentId: string,
    @Param('commentId') commentId: string,
    @Body() replyDto: ReplyCommentDto,
    @Body('userId') userId: string,
  ) {
    return this.commentsService.reply(documentId, commentId, userId, replyDto);
  }
}

@Controller('comments')
export class CommentDetailController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * 获取评论详情
   */
  @Get(':commentId')
  findOne(@Param('commentId') commentId: string) {
    return this.commentsService.findOne(commentId);
  }

  /**
   * 更新评论
   */
  @Patch(':commentId')
  update(
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Body('userId') userId: string,
  ) {
    return this.commentsService.update(commentId, userId, updateCommentDto);
  }

  /**
   * 删除评论
   */
  @Delete(':commentId')
  remove(
    @Param('commentId') commentId: string,
    @Query('userId') userId: string,
  ) {
    return this.commentsService.remove(commentId, userId);
  }

  /**
   * 解决评论
   */
  @Patch(':commentId/resolve')
  resolve(
    @Param('commentId') commentId: string,
    @Body('userId') userId: string,
  ) {
    return this.commentsService.resolve(commentId, userId);
  }

  /**
   * 取消解决评论
   */
  @Patch(':commentId/unresolve')
  unresolve(
    @Param('commentId') commentId: string,
    @Body('userId') userId: string,
  ) {
    return this.commentsService.unresolve(commentId, userId);
  }
}
