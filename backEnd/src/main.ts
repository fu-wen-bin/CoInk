import { NestFactory } from '@nestjs/core';
import session from 'express-session';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// 应用入口：注册中间件、拦截器与过滤器
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
}

// 启动应用（明确忽略返回 Promise）
void bootstrap();
