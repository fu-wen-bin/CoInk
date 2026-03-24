import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
