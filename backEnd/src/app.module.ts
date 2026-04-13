import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DocumentsModule } from './documents/documents.module';
import { GroupsModule } from './groups/groups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PermissionRequestsModule } from './permission-requests/permission-requests.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';
import { AiModule } from './ai/ai.module';
import { FriendsModule } from './friends/friends.module';

@Module({
  imports: [
    // 必须最先加载，其它模块在构造时才能读到 process.env（.env 文件）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RealtimeModule,
    PrismaModule,
    UserModule,
    DocumentsModule,
    AuthModule,
    GroupsModule,
    NotificationsModule,
    PermissionRequestsModule,
    FriendsModule,
    UploadModule,
    CollaborationModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
