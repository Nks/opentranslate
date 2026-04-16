import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'
import stylistic from '@stylistic/eslint-plugin'
import unusedImports from 'eslint-plugin-unused-imports'
import antiTrojanSource from 'eslint-plugin-anti-trojan-source'
import securityNode from 'eslint-plugin-security-node'
import boundaries from 'eslint-plugin-boundaries'
import sonarjs from 'eslint-plugin-sonarjs'
import vue from 'eslint-plugin-vue'

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
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  ReadableStream: 'readonly',
  RequestInit: 'readonly',
  BodyInit: 'readonly',
  File: 'readonly',
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
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

  // Vue SFC files — use vue-eslint-parser + vue plugin.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...nodeGlobals,
        window: 'readonly',
        document: 'readonly',
      },
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue,
    },
    rules: {
      'vue/require-typed-ref': 'error',
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.name="ref"]:not([typeArguments])',
        message: 'ref() must have an explicit type parameter, e.g., ref<boolean>(false)',
      }, {
        selector: 'CallExpression[callee.name="computed"]:not([typeArguments])',
        message: 'computed() must have an explicit type parameter, e.g., computed<string>(() => ...)',
      }, {
        selector: 'CallExpression[callee.name="defineProps"] > TSTypeParameterInstantiation > TSTypeLiteral',
        message: 'Extract props type into `interface Props { ... }` then use `defineProps<Props>()`',
      }, {
        selector: 'CallExpression[callee.name="defineEmits"] > TSTypeParameterInstantiation > TSTypeLiteral',
        message: 'Extract emits type into `interface Emits { ... }` then use `defineEmits<Emits>()`',
      }],
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
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'unused-imports': unusedImports,
      sonarjs,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // --- Redundancy detection (sonarjs) ---
      // Catches `const x = foo(); return x` → `return foo()` and similar
      // redundant-variable / redundant-branch / redundant-jump patterns.
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'error',

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
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      }],
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'with-single-extends',
        },
      ],
      '@typescript-eslint/no-redeclare': 'error',
      'no-redeclare': 'off',

      // --- General code style enforced as errors ---
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'id-length': ['error', {
        min: 2,
        exceptions: idLengthExceptions,
        properties: 'never',
      }],

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
    plugins: {
      'anti-trojan-source': antiTrojanSource,
    },
    rules: {
      'anti-trojan-source/no-bidi': 'error',
    },
  },

  // security-node: only applies to Electron main-process code (node runtime)
  {
    files: ['electron/**/*.ts'],
    plugins: {
      'security-node': securityNode,
    },
    rules: {
      ...securityNode.configs.recommended.rules,
    },
  },

  // Architecture boundaries: enforce main / preload / renderer / shared layering
  {
    name: 'opentranslate/boundaries',
    files: ['electron/**/*.ts', 'app/**/*.{ts,tsx,vue}', 'shared/**/*.ts'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
      'boundaries/elements': [
        {
          type: 'shared',
          pattern: 'shared/**/*',
          mode: 'full',
        },
        {
          type: 'electron-providers',
          pattern: 'electron/providers/**/*',
          mode: 'full',
        },
        {
          type: 'electron-services',
          pattern: 'electron/services/**/*',
          mode: 'full',
        },
        {
          type: 'electron-ipc',
          pattern: 'electron/ipc/**/*',
          mode: 'full',
        },
        {
          type: 'electron-preload',
          pattern: 'electron/preload/**/*',
          mode: 'full',
        },
        {
          type: 'electron-main',
          pattern: 'electron/main/**/*',
          mode: 'full',
        },
        {
          type: 'app',
          pattern: 'app/**/*',
          mode: 'full',
        },
      ],
    },
    rules: {
      'boundaries/no-ignored': 'off',
      'boundaries/no-private': 'off',
      'boundaries/no-unknown': 'off',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: '${file.type} is not allowed to import ${dependency.type}',
          rules: [
            {
              from: { type: 'shared' },
              allow: { to: [{ type: 'shared' }] },
            },
            {
              from: { type: 'electron-providers' },
              allow: { to: [{ type: 'shared' }, { type: 'electron-services' }, { type: 'electron-providers' }] },
            },
            {
              from: { type: 'electron-services' },
              allow: { to: [{ type: 'shared' }, { type: 'electron-providers' }, { type: 'electron-services' }] },
            },
            {
              from: { type: 'electron-ipc' },
              allow: { to: [{ type: 'shared' }, { type: 'electron-ipc' }] },
            },
            {
              from: { type: 'electron-preload' },
              allow: { to: [{ type: 'shared' }, { type: 'electron-ipc' }, { type: 'electron-preload' }] },
            },
            {
              from: { type: 'electron-main' },
              allow: {
                to: [
                  { type: 'shared' },
                  { type: 'electron-providers' },
                  { type: 'electron-services' },
                  { type: 'electron-ipc' },
                  { type: 'electron-preload' },
                  { type: 'electron-main' },
                ],
              },
            },
            {
              from: { type: 'app' },
              allow: { to: [{ type: 'shared' }, { type: 'app' }] },
            },
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
          multiline: {
            delimiter: 'none',
            requireLast: false,
          },
          singleline: {
            delimiter: 'semi',
            requireLast: false,
          },
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
        {
          avoidEscape: true,
          allowTemplateLiterals: 'always',
        },
      ],

      // Forbid inline object literals: any brace pair with >=1 member must
      // have its open brace on a line by itself and its close brace on a
      // line by itself. Empty `{}` is exempt. Applies uniformly to object
      // literals, patterns, and import/export specifiers — authors get
      // predictable, easy-to-diff formatting.
      // Objects with 1 property can stay inline: { ok: true }
      // Objects with 2+ properties must break across lines.
      '@stylistic/object-curly-newline': [
        'error',
        {
          multiline: true,
          minProperties: 2,
          consistent: true,
        },
      ],
      '@stylistic/object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: true,
        },
      ],

      // Require a blank line before control-flow / return / function / class
      // statements so code blocks breathe. First statement in a block is
      // exempt (there is no previous statement).
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'if',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'for',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'while',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'do',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'switch',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'try',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'throw',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'function',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'class',
        },
      ],
    },
  },
]
