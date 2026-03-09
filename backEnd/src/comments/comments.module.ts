import { Module } from '@nestjs/common';

import { CommentDetailController, CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController, CommentDetailController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
