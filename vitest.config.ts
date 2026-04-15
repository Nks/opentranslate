import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['shared/**/*.ts', 'electron/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts'],
    },
  },
});
