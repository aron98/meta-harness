import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@meta-harness/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@meta-harness/fixtures': fileURLToPath(new URL('./packages/fixtures/src/index.ts', import.meta.url)),
      '@meta-harness/plugin-core': fileURLToPath(
        new URL('./packages/plugin-core/src/index.ts', import.meta.url)
      ),
      '@meta-harness/opencode-meta-harness': fileURLToPath(
        new URL('./packages/plugins/opencode-meta-harness/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    include: [
      'apps/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'packages/plugin-core/test/**/*.test.ts',
      'packages/plugins/*/test/**/*.test.ts'
    ]
  }
});
