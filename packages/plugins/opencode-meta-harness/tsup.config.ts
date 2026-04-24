import { defineConfig } from 'tsup'

const noExternal = ['@meta-harness/core', '@meta-harness/plugin-core', 'zod']

export default defineConfig([
  {
    entry: ['src/index.ts'],
    dts: true,
    format: ['esm', 'cjs'],
    clean: true,
    noExternal
  },
  {
    entry: ['src/cli.ts'],
    dts: true,
    format: ['esm'],
    clean: false,
    banner: {
      js: '#!/usr/bin/env node'
    },
    noExternal
  }
])
