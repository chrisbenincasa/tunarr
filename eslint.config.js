import globals from 'globals';
import eslint from '@eslint/js';
import tseslint, { parser } from 'typescript-eslint';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import jsxRuntime from 'eslint-plugin-react/configs/jsx-runtime.js';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/.tsup/*',
      '**/dist/*',
      '**/build/*',
      '**/*.config.ts',
      '**/*.ignore.ts',
      '**/*.test.ts', // Ignore test files for now, until we fix up tsconfig files
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './server/tsconfig.build.json',
          './shared/tsconfig.json',
          './types/tsconfig.json',
          './web/tsconfig.build.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['web/src/**/*.tsx', 'web/src/**/*.ts'],
    ...reactRecommended,
    extends: [jsxRuntime],
    plugins: {
      // react,
      'react-refresh': reactRefresh,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser,
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Don't error on promise-returning functions in JSX attributes
      '@typescript-eslint/no-misused-promises': [
        2,
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
);
