import globals from 'globals';
import eslint from '@eslint/js';
import tseslint, { parser } from 'typescript-eslint';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import jsxRuntime from 'eslint-plugin-react/configs/jsx-runtime.js';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactHooks from 'eslint-plugin-react-hooks';
import noUnusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  {
    ignores: [
      '**/.tsup/*',
      '**/dist/*',
      '**/build/*',
      '**/scripts/*',
      '**/*.config.ts',
      '**/*.ignore.ts',
      '**/*.test.ts', // Ignore test files for now, until we fix up tsconfig files
      'server/src/migrations/**/*.ts', // Ignore DB migration files
    ],
  },
  {
    plugins: {
      'unused-imports': noUnusedImports,
    },
    rules: {
      'unused-imports/no-unused-imports': 'error',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './server/tsconfig.json',
          './shared/tsconfig.json',
          './types/tsconfig.json',
          './web/tsconfig.build.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn', // or "error"
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
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
