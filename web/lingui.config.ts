import { defineConfig } from '@lingui/cli';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es', 'zh-CN', 'pseudo-LOCALE'],
  pseudoLocale: 'pseudo-LOCALE',
  fallbackLocales: {
    es: 'en',
    'zh-CN': 'en',
    'pseudo-LOCALE': 'en',
    default: 'en',
  },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
});
