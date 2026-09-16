import { defineConfig, env } from 'prisma/config';
import { config } from 'dotenv';

if (!['test', 'production'].includes(process.env.NODE_ENV ?? '')) {
  config({ path: ['.env.local', '.env'], quiet: true });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
