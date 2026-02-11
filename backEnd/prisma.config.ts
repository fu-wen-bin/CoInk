import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const url = env('DATABASE_URL');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url,
  },
});
