import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runTaskEndCommand } from '../src/task-end';

const tempDirectories: string[] = [];

const taskEndEvent = {
  id: 'task-end-001',
  repoId: 'repo-a',
  taskId: 'task-001',
  taskType: 'verification',
  taskText: 'Verify the release build and report whether it passes with evidence.',
  promptSummary: 'Verified the release build and captured the result with supporting evidence.',
  selectedMemoryIds: ['memory-build'],
  selectedArtifactIds: ['artifact-build'],
  suggestedRoute: 'verify',
  verificationState: {
    status: 'passed',
    checklist: ['Capture the exact verification command results and status.', 'Run pnpm build.', 'Run pnpm test.'],
    completedSteps: ['Capture the exact verification command results and status.', 'Run pnpm build.', 'Run pnpm test.']
  },
  unresolvedQuestions: [],
  filesInspected: ['package.json', 'pnpm-workspace.yaml'],
  filesChanged: [],
  commands: ['pnpm build', 'pnpm test'],
  diagnostics: ['Build completed without TypeScript errors.', 'Tests passed in the release workspace.'],
  outcome: 'success',
  cost: 0.18,
  latencyMs: 4200,
  tags: ['verify', 'build', 'release'],
  startedAt: '2026-04-21T12:10:00.000Z',
  endedAt: '2026-04-21T12:14:12.000Z'
} as const;

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runTaskEndCommand', () => {
  it('writes the runtime task-end payload and derived artifact record', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-task-end-'));
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    const result = await runTaskEndCommand(
      ['--data-root', dataRoot, '--input', JSON.stringify(taskEndEvent)],
      { log },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(result.eventFilePath).toBe(join(dataRoot, 'data/runtime/task-end/repo-a/task-001.json'));
    expect(result.artifactFilePath).toBe(join(dataRoot, 'data/artifacts/repo-a/task-end-001.json'));
    expect(result.record.id).toBe('task-end-001');
    expect(result.record.tags).toContain('verify');
    expect(result.record.tags).toContain('passed');
    expect(log).toHaveBeenCalledWith('Captured task end task-end-001 as artifact task-end-001 (success)');
    await expect(readFile(result.eventFilePath, 'utf8')).resolves.toContain('Verified the release build');
    await expect(readFile(result.artifactFilePath, 'utf8')).resolves.toContain('Verification status: passed');
  });

  it('returns a failed result when required arguments are missing', async () => {
    const error = vi.fn();

    const result = await runTaskEndCommand([], { log: vi.fn() }, { error });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected missing arguments to fail');
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('error: task-end failed: missing required --data-root and one of --input or --input-file');
    expect(error).toHaveBeenCalledWith(result.error);
  });

  it('accepts --input-file and emits machine-readable output with --json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-cli-task-end-'));
    const inputFile = join(dataRoot, 'task-end.json');
    const log = vi.fn();

    tempDirectories.push(dataRoot);

    await writeFile(inputFile, `${JSON.stringify(taskEndEvent, null, 2)}\n`);

    const result = await runTaskEndCommand(
      ['--data-root', dataRoot, '--input-file', inputFile, '--json'],
      { log },
      { error: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, received ${result.error}`);
    }
    expect(JSON.parse(result.output)).toEqual({
      eventFilePath: join(dataRoot, 'data/runtime/task-end/repo-a/task-001.json'),
      artifactFilePath: join(dataRoot, 'data/artifacts/repo-a/task-end-001.json'),
      event: result.event,
      record: result.record
    });
    expect(log).toHaveBeenCalledWith(result.output);
  });
});
