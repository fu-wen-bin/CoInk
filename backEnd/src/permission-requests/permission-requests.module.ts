import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { PermissionRequestsController } from './permission-requests.controller';
import { PermissionRequestsService } from './permission-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PermissionRequestsController],
  providers: [PermissionRequestsService],
  exports: [PermissionRequestsService],
})
export class PermissionRequestsModule {}

