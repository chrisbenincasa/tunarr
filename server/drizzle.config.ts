import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  // Test files import Vitest, which fails to load under drizzle-kit.
  schema: './src/db/schema/**/!(*.test).ts',
  out: './src/migration/db/sql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.TUNARR_DATABASE_PATH!,
  },
});
