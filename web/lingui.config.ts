import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

export default defineConfig({
  sourceLocale: 'en',
  // Keep file origins but drop line numbers, so editing a component doesn't
  // rewrite every catalog entry below the edit.
  format: formatter({ lineNumbers: false }),
  locales: ['en', 'es', 'pseudo-LOCALE'],
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
