import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { DocumentsModule } from './documents/documents.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    DocumentsModule, // 初始化 DocumentsModule
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，无需在其他模块导入
      envFilePath: '.env', // 指定环境变量文件路径
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
