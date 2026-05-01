import { defineConfig } from '@lingui/cli';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es', 'ro', 'pseudo-LOCALE'],
  pseudoLocale: 'pseudo-LOCALE',
  fallbackLocales: {
    es: 'en',
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
