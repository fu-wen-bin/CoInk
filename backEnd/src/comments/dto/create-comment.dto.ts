import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 评论在文档中的位置
 */
export interface CommentPosition {
  blockId: string;
  offset?: number;
  length?: number;
}

/**
 * 创建评论 DTO
 */
export class CreateCommentDto {
  @IsString()
  @MaxLength(5000)
  content: string;

  @IsObject()
  @IsOptional()
  position?: CommentPosition;

  @IsString()
  @IsOptional()
  parentId?: string;
}

/**
 * 回复评论 DTO
 */
export class ReplyCommentDto {
  @IsString()
  @MaxLength(5000)
  content: string;
}
