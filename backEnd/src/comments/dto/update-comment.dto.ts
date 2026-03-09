import { PartialType } from '@nestjs/mapped-types';

import { CreateCommentDto } from './create-comment.dto';

/**
 * 更新评论 DTO
 */
export class UpdateCommentDto extends PartialType(CreateCommentDto) {}
