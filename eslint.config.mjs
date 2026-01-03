import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxRuntime from 'eslint-plugin-react/configs/jsx-runtime.js';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import noUnusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint, { parser } from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      // 'eslint.config.js',
      '**/.tsup/*',
      '**/dist/*',
      '**/build/*',
      '**/scripts/*',
      '**/*.config.ts',
      '**/*.ignore.ts',
      '**/*.test.ts', // Ignore test files for now, until we fix up tsconfig files
      '**/generated/*', // Ignore all generated code
      'server/esbuild/*',
      'server/src/web/*',
      'server/src/testing/*',
      'server/cjs-shim.ts',
      // 'release.config.mjs',
    ],
  },
  {
    plugins: {
      'unused-imports': noUnusedImports,
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
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
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/consistent-type-imports': ['error'],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: true,
        },
      ],
    },
  },
  {
    files: ['web/src/**/*.tsx', 'web/src/**/*.ts', 'web/src/**/*.d.ts'],
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
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: ['Redirect', 'NotFoundError'],
          allowThrowingAny: false,
          allowThrowingUnknown: false,
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
