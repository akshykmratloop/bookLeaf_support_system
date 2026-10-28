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
    files: ['apps/api/**/*.ts', 'apps/host-demo/**/*.ts', 'eval/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Plain browser scripts served as they are (the demo host page, the embed loader).
    files: ['apps/*/public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/ai/providers/anthropic/**',
      'apps/api/src/host/registry.ts',
      'apps/api/src/host/workspaces.ts',
      'apps/api/src/host/http/**',
      'apps/api/src/host/fake/**',
      'apps/api/src/**/*.test.ts',
    ],
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
          patterns: [
            {
              group: ['**/providers/openai/*'],
              message:
                'Voice vendors are reached only through voice/providers/registry.ts and types.ts.',
            },
            {
              group: ['@bookleaf/host-demo', '**/host/http/*', '**/host/fake/*'],
              message:
                'The host product is reached only through host/types.ts (HostRecords) and host/registry.ts.',
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
  // Size and shape limits (CLAUDE.md §3.4, §10): small files, short functions, shallow nesting.
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-nested-callbacks': ['error', 3],
    },
  },
  {
    // A React component returns its markup, so it gets the component limit instead.
    files: ['apps/web/**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Tests group cases in describe/it callbacks; the file and depth limits still apply.
    files: ['**/*.test.{ts,tsx}', 'apps/api/test/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': ['error', 4],
      'max-params': ['error', 6],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
