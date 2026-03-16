import { Module } from '@nestjs/common';
import { HocuspocusService } from './hocuspocus.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * 协同编辑模块
 *
 * 提供 Hocuspocus WebSocket 服务用于实时协作编辑
 */
@Module({
  imports: [PrismaModule],
  providers: [HocuspocusService],
  exports: [HocuspocusService],
})
export class CollaborationModule {}
