import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import {
  dirname, resolve,
} from 'node:path'
import vue from '@vitejs/plugin-vue'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': resolve(rootDir, 'shared'),
      '@electron': resolve(rootDir, 'electron'),
      '@app': resolve(rootDir, 'app'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    setupFiles: ['./tests/setup/nuxt-globals.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['shared/**/*.ts', 'electron/**/*.ts', 'app/**/*.{ts,vue}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        'shared/types/**/*.ts',
        'shared/index.ts',
        'shared/providers/contract.ts',
        'electron/main/index.ts',
        'electron/preload/index.ts',
      ],
    },
  },
})
