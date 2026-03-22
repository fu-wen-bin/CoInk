import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// 应用入口：注册中间件、拦截器与过滤器
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 CORS，允许携带 Cookie
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Cookie 解析中间件（必须在使用 req.cookies 之前）
  app.use(cookieParser());

  // 会话中间件（如需可替换为 Redis 会话）
  app.use(
    session({
      secret: 'FWB',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      name: 'FWB.sid',
      cookie: { maxAge: 60000 },
    }),
  );

  // 全局统一响应与异常处理
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 8888);
  console.log('服务器启动在 http://localhost:' + (process.env.PORT ?? 8888));
}

// 启动应用（明确忽略返回 Promise）
void bootstrap();
