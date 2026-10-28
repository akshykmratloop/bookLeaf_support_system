import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint rules, including the architecture boundaries from docs/project/PLAN.md §5.2:
 * - the Anthropic SDK is imported only inside its provider adapter;
 * - route files never touch Prisma; AI and service code never imports Fastify at runtime;
 * - the API reads the time only through platform/clock.ts.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'graphify-out/**',
      '**/*.config.*',
      'eval/results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'eval/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/ai/providers/anthropic/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@anthropic-ai/sdk',
              message: 'Vendor SDKs live only in ai/providers/<vendor>/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/routes.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message: 'Routes call services; only repositories/services touch Prisma.',
            },
          ],
          patterns: [
            {
              group: ['**/platform/db.js'],
              message: 'Routes call services; only repositories/services touch Prisma.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/api/src/ai/**/*.ts',
      'apps/api/src/modules/**/service.ts',
      'apps/api/src/modules/**/repository.ts',
    ],
    ignores: ['apps/api/src/ai/providers/anthropic/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fastify',
              message: 'Business logic must not depend on the HTTP framework.',
              allowTypeImports: true,
            },
            {
              name: '@anthropic-ai/sdk',
              message: 'Vendor SDKs live only in ai/providers/<vendor>/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/platform/clock.ts', 'apps/api/src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use the injected Clock (platform/clock.ts).',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Use the injected Clock (platform/clock.ts).',
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
