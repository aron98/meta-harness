import { describe, expect, it, vi } from 'vitest';

import { renderHelp, run } from '../src/index';

describe('renderHelp', () => {
  it('describes the scaffolded commands', () => {
    expect(renderHelp()).toContain('@meta-harness/core');
    expect(renderHelp()).toContain('pnpm test');
    expect(renderHelp()).toContain('build-first-slice');
  });
});

describe('run', () => {
  it('prints help for the help path', async () => {
    const log = vi.fn();

    const result = await run(['--help'], { log }, { error: vi.fn() });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('build-first-slice');
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

  it('runs build-first-slice via injected builder', async () => {
    const log = vi.fn();
    const buildFirstSliceArtifacts = vi.fn().mockResolvedValue({
      writtenFiles: ['schemas/fixture-authoring.schema.json', 'fixtures/index.md']
    });

    const result = await run(['build-first-slice'], { log }, { error: vi.fn(), buildFirstSliceArtifacts });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(buildFirstSliceArtifacts).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenNthCalledWith(1, 'Wrote files:');
    expect(log).toHaveBeenNthCalledWith(2, '- schemas/fixture-authoring.schema.json');
    expect(log).toHaveBeenNthCalledWith(3, '- fixtures/index.md');
  });

  it('returns a failed result when build-first-slice rejects', async () => {
    const log = vi.fn();
    const error = vi.fn();
    const buildFirstSliceArtifacts = vi.fn().mockRejectedValue(new Error('disk full'));

    const result = await run(['build-first-slice'], { log }, { error, buildFirstSliceArtifacts });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    if (result.success) {
      throw new Error('expected build-first-slice rejection to fail');
    }
    expect(result.error).toContain('build-first-slice failed');
    expect(result.error).toContain('disk full');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('build-first-slice failed'));
    expect(log).not.toHaveBeenCalledWith(renderHelp());
  });
});
