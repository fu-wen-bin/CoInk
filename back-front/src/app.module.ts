import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { DocumentsModule } from './documents/documents.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [UserModule, DocumentsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
