import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8')) as Record<string, unknown>;
}

function readText(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('plugin workspace bootstrap', () => {
  it('recognizes plugin-core and nested plugin packages as workspace packages', () => {
    const workspaceConfig = readText('pnpm-workspace.yaml');

    expect(workspaceConfig).toContain('packages/plugin-core');
    expect(workspaceConfig).toContain('packages/plugins/*');
    expect(workspaceConfig).not.toContain('- packages/plugin\n');
  });

  it('publishes path aliases for the new package layout only', () => {
    const tsconfig = readJson('tsconfig.base.json');
    const compilerOptions = tsconfig.compilerOptions as { paths?: Record<string, string[]> };

    expect(compilerOptions.paths).toMatchObject({
      '@meta-harness/plugin-core': ['packages/plugin-core/src/index.ts'],
      '@meta-harness/opencode-meta-harness': [
        'packages/plugins/opencode-meta-harness/src/index.ts'
      ]
    });
    expect(compilerOptions.paths).not.toHaveProperty('@meta-harness/plugin');
  });

  it('includes nested plugin package tests in vitest discovery', () => {
    const vitestConfig = readText('vitest.config.ts');

    expect(vitestConfig).toContain("'packages/plugin-core/test/**/*.test.ts'");
    expect(vitestConfig).toContain("'packages/plugins/*/test/**/*.test.ts'");
    expect(vitestConfig).not.toContain("'packages/plugin/test/**/*.test.ts'");
  });

  it('creates first-class package manifests for the new adapter boundary', () => {
    expect(existsSync(resolve(repoRoot, 'packages/plugin-core/package.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot, 'packages/plugins/opencode-meta-harness/package.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot, 'packages/plugin/package.json'))).toBe(false);

    const pluginCorePackage = readJson('packages/plugin-core/package.json');
    const opencodePackage = readJson('packages/plugins/opencode-meta-harness/package.json');

    expect(pluginCorePackage.name).toBe('@meta-harness/plugin-core');
    expect(opencodePackage.name).toBe('@meta-harness/opencode-meta-harness');
  });
});
