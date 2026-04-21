import { describe, expect, it, vi } from 'vitest';

import { renderHelp, run } from '../src/index';

describe('renderHelp', () => {
  it('describes the scaffolded commands', () => {
    expect(renderHelp()).toContain('@meta-harness/core');
    expect(renderHelp()).toContain('pnpm test');
    expect(renderHelp()).toContain('build-fixture-artifacts');
  });
});

describe('run', () => {
  it('prints help for the help path', async () => {
    const log = vi.fn();

    const result = await run(['--help'], { log }, { error: vi.fn() });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('build-fixture-artifacts');
    expect(log).toHaveBeenCalledWith(result.output);
  });

  it('reports unknown commands as errors', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const result = await run(['wat'], { log }, { error });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected unknown command to fail');
    }
    expect(result.error).toContain('Unknown command: wat');
    expect(error).toHaveBeenCalledWith('Unknown command: wat');
    expect(log).toHaveBeenCalledWith(renderHelp());
  });

  it('runs build-fixture-artifacts via injected builder', async () => {
    const log = vi.fn();
    const buildFixtureArtifacts = vi.fn().mockResolvedValue({
      writtenFiles: ['schemas/fixture-authoring.schema.json', 'fixtures/index.md']
    });

    const result = await run(['build-fixture-artifacts'], { log }, { error: vi.fn(), buildFixtureArtifacts });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(buildFixtureArtifacts).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenNthCalledWith(1, 'Wrote files:');
    expect(log).toHaveBeenNthCalledWith(2, '- schemas/fixture-authoring.schema.json');
    expect(log).toHaveBeenNthCalledWith(3, '- fixtures/index.md');
  });

  it('returns a failed result when build-fixture-artifacts rejects', async () => {
    const log = vi.fn();
    const error = vi.fn();
    const buildFixtureArtifacts = vi.fn().mockRejectedValue(new Error('disk full'));

    const result = await run(['build-fixture-artifacts'], { log }, { error, buildFixtureArtifacts });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    if (result.success) {
      throw new Error('expected build-fixture-artifacts rejection to fail');
    }
    expect(result.error).toContain('build-fixture-artifacts failed');
    expect(result.error).toContain('disk full');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('build-fixture-artifacts failed'));
    expect(log).not.toHaveBeenCalledWith(renderHelp());
  });
});
