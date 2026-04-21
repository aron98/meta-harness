import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@meta-harness/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@meta-harness/fixtures': fileURLToPath(new URL('./packages/fixtures/src/index.ts', import.meta.url)),
      '@meta-harness/plugin': fileURLToPath(new URL('./packages/plugin/src/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['apps/*/test/**/*.test.ts', 'packages/*/test/**/*.test.ts']
  }
});
