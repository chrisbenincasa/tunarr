import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema/**/*.ts',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.TUNARR_DATABASE_PATH,
  },
});
