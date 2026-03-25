import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HocuspocusService } from './hocuspocus.service';

/**
 * 协同编辑模块
 *
 * 提供 Hocuspocus WebSocket 服务用于实时协作编辑
 */
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [HocuspocusService],
  exports: [HocuspocusService],
})
export class CollaborationModule {}
