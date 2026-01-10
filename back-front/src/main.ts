import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';

async function bootstrap () {
  const app = await NestFactory.create(AppModule);
  app.use(session({
    secret: 'FWB',
    rolling: true,
    name: 'FWB.sid',
    cookie: { maxAge: 60000 },
  }));
  await app.listen(process.env.PORT ?? 8888);
}

bootstrap();
