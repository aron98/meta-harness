import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@meta-harness/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@meta-harness/fixtures': fileURLToPath(new URL('./src/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['test/**/*.test.ts']
  }
});
