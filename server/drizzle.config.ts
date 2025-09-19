import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema/**/*.ts',
  out: './src/migration/db/sql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.TUNARR_DATABASE_PATH!,
  },
});
