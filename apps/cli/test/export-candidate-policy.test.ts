import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runExportCandidatePolicyCommand } from '../src/export-candidate-policy';

const candidate = {
  id: 'baseline',
  label: 'Baseline policy',
  createdAt: '2026-04-26T12:00:00.000Z',
  mutationIds: [],
  policy: {
    retrieval: {
      repoMatchWeight: 10,
      tagOverlapWeight: 3,
      recentMaxBonus: 4,
      recentHalfLifeDays: 7,
      taskTypeWeight: 8,
      outcomeWeight: 4,
      taskLocalMemoryBonus: 1
    },
    routing: {
      taskTypeOrder: ['verification', 'planning', 'documentation', 'fix', 'codegen', 'analysis'],
      buildPromptMode: 'default'
    },
    verification: {
      includeArtifactVerificationCommands: true,
      includeMemoryCommandHints: true,
      requirePromptClarificationOnUnclear: true
    }
  }
};

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('runExportCandidatePolicyCommand', () => {
  it('requires data root, run id, and output file', async () => {
    const error = vi.fn();

    const result = await runExportCandidatePolicyCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing args to fail');
    }
    expect(result.error).toBe('error: export-candidate-policy failed: missing required --data-root, --run-id, and --output-file');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('exports the winner policy and emits JSON output', async () => {
    const log = vi.fn();
    const exportCandidatePolicy = vi.fn().mockResolvedValue({
      runId: 'run-export',
      candidateId: 'baseline',
      outputFile: '/tmp/winner-policy.json'
    });

    const result = await runExportCandidatePolicyCommand(
      [
        '--data-root',
        '/tmp/meta-harness',
        '--run-id',
        'run-export',
        '--output-file',
        '/tmp/winner-policy.json',
        '--json'
      ],
      { log },
      { error: vi.fn(), exportPolicy: exportCandidatePolicy }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(exportCandidatePolicy).toHaveBeenCalledWith({
      dataRoot: '/tmp/meta-harness',
      runId: 'run-export',
      outputFile: '/tmp/winner-policy.json'
    });
    expect(JSON.parse(result.output)).toEqual({
      runId: 'run-export',
      candidateId: 'baseline',
      outputFile: '/tmp/winner-policy.json'
    });
    expect(log).toHaveBeenCalledWith(result.output);
  });

  it('writes only the requested output file and does not mutate OpenCode config', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-export-safe-'));
    tempDirectories.push(dataRoot);
    const candidateRoot = join(dataRoot, 'data/candidate-runs/run-export/candidates/baseline');
    const outputFile = join(dataRoot, 'winner-policy.json');
    const opencodeConfigFile = join(dataRoot, '.opencode', 'config.json');
    const originalConfig = '{"provider":"local"}\n';

    await mkdir(join(dataRoot, '.opencode'), { recursive: true });
    await mkdir(candidateRoot, { recursive: true });
    await writeFile(opencodeConfigFile, originalConfig, 'utf8');
    await writeFile(
      join(dataRoot, 'data/candidate-runs/run-export/selection.json'),
      JSON.stringify({ runId: 'run-export', candidateId: 'baseline', score: 1.23 }),
      'utf8'
    );
    await writeFile(join(candidateRoot, 'candidate.json'), JSON.stringify(candidate), 'utf8');

    const result = await runExportCandidatePolicyCommand(
      ['--data-root', dataRoot, '--run-id', 'run-export', '--output-file', outputFile],
      { log: vi.fn() },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    expect(JSON.parse(await readFile(outputFile, 'utf8'))).toEqual({
      runId: 'run-export',
      candidateId: 'baseline',
      policy: candidate.policy
    });
    expect(await readFile(opencodeConfigFile, 'utf8')).toBe(originalConfig);
  });
});
