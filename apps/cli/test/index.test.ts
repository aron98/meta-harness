import { describe, expect, it, vi } from 'vitest';

import { renderHelp, run } from '../src/index';

describe('renderHelp', () => {
  it('describes the scaffolded commands', () => {
    expect(renderHelp()).toContain('@meta-harness/core');
    expect(renderHelp()).toContain('pnpm test');
    expect(renderHelp()).toContain('build-fixture-artifacts');
    expect(renderHelp()).toContain('log-artifact');
    expect(renderHelp()).toContain('promote-memory');
    expect(renderHelp()).toContain('query-history');
    expect(renderHelp()).toContain('prepare-session');
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

  it('dispatches log-artifact via injected command handler', async () => {
    const log = vi.fn();
    const logArtifact = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'artifact-001'
    });

    const result = await run(['log-artifact', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      logArtifact
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'artifact-001' });
    expect(logArtifact).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });

  it('dispatches promote-memory via injected command handler', async () => {
    const log = vi.fn();
    const promoteMemory = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'memory-001'
    });

    const result = await run(['promote-memory', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      promoteMemory
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'memory-001' });
    expect(promoteMemory).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });

  it('dispatches query-history via injected command handler', async () => {
    const log = vi.fn();
    const queryHistory = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'history'
    });

    const result = await run(['query-history', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      queryHistory
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'history' });
    expect(queryHistory).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });

  it('dispatches prepare-session via injected command handler', async () => {
    const log = vi.fn();
    const prepareSession = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'packet-001'
    });

    const result = await run(['prepare-session', '--data-root', '/tmp/store', '--input', '{}'], { log }, {
      error: vi.fn(),
      prepareSession
    });

    expect(result).toEqual({ success: true, exitCode: 0, output: 'packet-001' });
    expect(prepareSession).toHaveBeenCalledWith(['--data-root', '/tmp/store', '--input', '{}'], { log }, expect.any(Object));
  });
});
