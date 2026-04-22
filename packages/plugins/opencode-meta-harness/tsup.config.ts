import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  format: ['esm', 'cjs'],
  clean: true,
  noExternal: ['@meta-harness/core', '@meta-harness/plugin-core', 'zod']
})
