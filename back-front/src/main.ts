import { NestFactory } from '@nestjs/core';
import session from 'express-session';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    session({
      secret: 'FWB',
      rolling: true,
      name: 'FWB.sid',
      cookie: { maxAge: 60000 },
    }),
  );
  await app.listen(process.env.PORT ?? 8888);
}

bootstrap();
