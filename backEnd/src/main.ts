import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RealtimeService } from './realtime/realtime.service';

/** JSON / urlencoded 体积上限（文档版本含 TipTap JSON + yState Base64 时易超过默认 100kb） */
const BODY_PARSER_LIMIT = process.env.BODY_PARSER_LIMIT ?? '32mb';

// 应用入口：注册中间件、拦截器与过滤器
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(json({ limit: BODY_PARSER_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_PARSER_LIMIT }));

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

  // 本地上传文件静态访问（非 OSS 模式）
  app.useStaticAssets(path.join(process.cwd(), '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // 全局统一响应与异常处理
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 8888);
  app.get(RealtimeService).attach(app);
  console.log('服务器启动在 http://localhost:' + (process.env.PORT ?? 8888));
}

// 启动应用（明确忽略返回 Promise）
void bootstrap();
