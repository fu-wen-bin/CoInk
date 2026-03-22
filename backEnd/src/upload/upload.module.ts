import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { OssService } from './oss.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadController],
  providers: [UploadService, OssService],
  exports: [UploadService],
})
export class UploadModule {}
