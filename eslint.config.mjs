import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'
import stylistic from '@stylistic/eslint-plugin'
import unusedImports from 'eslint-plugin-unused-imports'
import antiTrojanSource from 'eslint-plugin-anti-trojan-source'
import securityNode from 'eslint-plugin-security-node'
import boundaries from 'eslint-plugin-boundaries'

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'writable',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  crypto: 'readonly',
  NodeJS: 'readonly',
}

const idLengthExceptions = ['_']

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'out/**',
      'release/**',
      '.nuxt/**',
      '.output/**',
      'coverage/**',
      'playwright-report/**',
      '.claude/**',
      '.claude-flow/**',
      '.swarm/**',
      '.github/**',
      '.idea/**',
      'build/**',
      '**/*.d.ts',
      'pnpm-lock.yaml',
    ],
  },

  // Base JS/TS rules
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    ...js.configs.recommended,
  },

  // Vue SFC files — use vue-eslint-parser and delegate <script lang="ts"> to tsParser.
  // Vue-specific rules land in Phase 6 with @nuxt/eslint-config.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...nodeGlobals, window: 'readonly', document: 'readonly' },
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },

  // TypeScript rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'unused-imports': unusedImports,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // --- Unused vars: delegate to unused-imports plugin ---
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // --- TS safety ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      '@typescript-eslint/no-redeclare': 'error',
      'no-redeclare': 'off',

      // --- General code style enforced as errors ---
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'id-length': ['error', { min: 2, exceptions: idLengthExceptions }],

      // --- Force path aliases: no relative parent imports ---
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../**/*'],
              message:
                'Use @shared, @electron, or @app path aliases instead of relative parent (../) imports.',
            },
          ],
        },
      ],
    },
  },

  // Anti-trojan-source: catches bidi / zero-width unicode attacks globally
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,vue}'],
    plugins: { 'anti-trojan-source': antiTrojanSource },
    rules: {
      'anti-trojan-source/no-bidi': 'error',
    },
  },

  // security-node: only applies to Electron main-process code (node runtime)
  {
    files: ['electron/**/*.ts'],
    plugins: { 'security-node': securityNode },
    rules: {
      ...securityNode.configs.recommended.rules,
    },
  },

  // Architecture boundaries: enforce main / preload / renderer / shared layering
  {
    name: 'opentranslate/boundaries',
    files: ['electron/**/*.ts', 'app/**/*.{ts,tsx,vue}', 'shared/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
      'boundaries/elements': [
        { type: 'shared', pattern: 'shared/**/*', mode: 'full' },
        { type: 'electron-providers', pattern: 'electron/providers/**/*', mode: 'full' },
        { type: 'electron-services', pattern: 'electron/services/**/*', mode: 'full' },
        { type: 'electron-ipc', pattern: 'electron/ipc/**/*', mode: 'full' },
        { type: 'electron-preload', pattern: 'electron/preload/**/*', mode: 'full' },
        { type: 'electron-main', pattern: 'electron/main/**/*', mode: 'full' },
        { type: 'app', pattern: 'app/**/*', mode: 'full' },
      ],
    },
    rules: {
      'boundaries/no-ignored': 'off',
      'boundaries/no-private': 'off',
      'boundaries/no-unknown': 'off',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message: '${file.type} is not allowed to import ${dependency.type}',
          rules: [
            { from: 'shared', allow: ['shared'] },
            { from: 'electron-providers', allow: ['shared', 'electron-providers'] },
            {
              from: 'electron-services',
              allow: ['shared', 'electron-providers', 'electron-services'],
            },
            { from: 'electron-ipc', allow: ['shared', 'electron-ipc'] },
            {
              from: 'electron-preload',
              allow: ['shared', 'electron-ipc', 'electron-preload'],
            },
            {
              from: 'electron-main',
              allow: [
                'shared',
                'electron-providers',
                'electron-services',
                'electron-ipc',
                'electron-preload',
                'electron-main',
              ],
            },
            { from: 'app', allow: ['shared', 'app'] },
          ],
        },
      ],
    },
  },

  // Stylistic plugin — replaces Prettier. All formatting rules driven from here.
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    jsx: false,
    arrowParens: true,
    commaDangle: 'always-multiline',
    braceStyle: '1tbs',
    quoteProps: 'as-needed',
    blockSpacing: true,
  }),
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      // Max line length (was Prettier printWidth)
      '@stylistic/max-len': [
        'error',
        {
          code: 100,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: false,
        },
      ],

      // Unix line endings only (was Prettier endOfLine: 'lf')
      '@stylistic/linebreak-style': ['error', 'unix'],

      // Type-member delimiter: multiline has no delimiter, inline uses `;`
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: { delimiter: 'none', requireLast: false },
          singleline: { delimiter: 'semi', requireLast: false },
        },
      ],

      // Operator line-break alignment: `=` stays at end; `|`, `&`, `?`, `:` break before
      '@stylistic/operator-linebreak': [
        'error',
        'after',
        {
          overrides: {
            '?': 'before',
            ':': 'before',
            '|': 'before',
            '&': 'before',
          },
        },
      ],

      // EOF newline (Prettier always enforces)
      '@stylistic/eol-last': ['error', 'always'],

      // No trailing whitespace (Prettier strips on save)
      '@stylistic/no-trailing-spaces': 'error',

      // Single quotes for JSX props too, no mixed quotes
      '@stylistic/quotes': [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: 'always' },
      ],
    },
  },
]
