import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCompactSessionCommand } from '../src/compact-session';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runCompactSessionCommand', () => {
  it('writes a bounded compaction summary and prints a concise summary', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-compact-session-'));
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    const result = await runCompactSessionCommand(
      [
        '--data-root',
        dataRoot,
        '--input',
        JSON.stringify({
          repoId: 'repo-a',
          taskId: 'task-001',
          taskText: 'Verify the release build and report whether it passes with evidence. '.repeat(8),
          selectedMemoryIds: ['memory-1', 'memory-2', 'memory-3', 'memory-4'],
          selectedArtifactIds: ['artifact-1', 'artifact-2', 'artifact-3'],
          suggestedRoute: 'verify',
          verificationState: {
            status: 'passed',
            checklist: ['one', 'two', 'three', 'four', 'five', 'six'],
            completedSteps: ['one', 'two', 'six']
          },
          unresolvedQuestions: ['question-1', 'question-2', 'question-3', 'question-4'],
          compactedAt: '2026-04-21T12:15:00.000Z',
          startedAt: '2026-04-21T12:10:00.000Z',
          endedAt: '2026-04-21T12:14:12.000Z'
        })
      ],
      { log },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.filePath).toBe(join(dataRoot, 'data/runtime/compaction/repo-a/task-001.json'));
    expect(result.summary.selectedMemoryIds).toEqual(['memory-1', 'memory-2', 'memory-3']);
    expect(result.summary.selectedArtifactIds).toEqual(['artifact-1', 'artifact-2']);
    expect(result.summary.verificationState.checklist).toEqual(['one', 'two', 'three', 'four', 'five']);
    expect(result.summary.verificationState.completedSteps).toEqual(['one', 'two']);
    expect(result.summary.unresolvedQuestions).toEqual(['question-1', 'question-2', 'question-3']);
    expect(result.summary.taskText.length).toBeLessThanOrEqual(280);
    expect(log).toHaveBeenCalledWith('Compacted task task-001 (verify) with 3 memory ids and 2 artifact ids');
    await expect(readFile(result.filePath, 'utf8')).resolves.toContain('task-001');
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runCompactSessionCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing arguments to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('error: compact-session failed: missing required --data-root and one of --input or --input-file');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('accepts --input-file and emits machine-readable output with --json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-compact-session-'));
    const inputFile = join(dataRoot, 'compaction.json');
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    await writeFile(
      inputFile,
      `${JSON.stringify(
        {
          repoId: 'repo-a',
          taskId: 'task-002',
          taskText: 'Verify the release build and report whether it passes with evidence.',
          selectedMemoryIds: ['memory-1'],
          selectedArtifactIds: ['artifact-1'],
          suggestedRoute: 'verify',
          verificationState: {
            status: 'pending',
            checklist: ['one'],
            completedSteps: []
          },
          unresolvedQuestions: ['question-1'],
          compactedAt: '2026-04-21T12:15:00.000Z',
          startedAt: '2026-04-21T12:10:00.000Z',
          endedAt: '2026-04-21T12:14:12.000Z'
        },
        null,
        2
      )}\n`
    );

    const result = await runCompactSessionCommand(
      ['--data-root', dataRoot, '--input-file', inputFile, '--json'],
      { log },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(JSON.parse(result.output)).toEqual({
      filePath: join(dataRoot, 'data/runtime/compaction/repo-a/task-002.json'),
      summary: result.summary
    });
    expect(log).toHaveBeenCalledWith(result.output);
  });
});
