import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { loadArtifactRecord, writeArtifactRecord, type ArtifactRecord } from '../src/index';

const tempDirectories: string[] = [];

const artifactRecord: ArtifactRecord = {
  id: 'artifact-001',
  taskType: 'codegen',
  repoId: 'meta-harness',
  taskId: 'task-123',
  promptSummary: 'Persist artifact records to disk.',
  filesInspected: ['packages/core/src/index.ts'],
  filesChanged: ['packages/core/src/artifact-store.ts'],
  commands: ['pnpm --filter @meta-harness/core test'],
  diagnostics: ['artifact store round-trip passed'],
  verification: ['pnpm --filter @meta-harness/core test -- artifact-store.test.ts'],
  outcome: 'success',
  cost: 0.08,
  latencyMs: 900,
  tags: ['phase-1', 'storage'],
  createdAt: '2026-04-21T12:00:00.000Z'
};

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
});

describe('artifact store', () => {
  it('stores artifacts under data/artifacts/<repo-id>/<artifact-id>.json with stable json', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-artifact-'));

    tempDirectories.push(dataRoot);

    const filePath = await writeArtifactRecord(dataRoot, artifactRecord);

    expect(filePath).toBe(join(dataRoot, 'data/artifacts/meta-harness/artifact-001.json'));

    const fileContent = await readFile(filePath, 'utf8');

    expect(fileContent).toBe(`${JSON.stringify(artifactRecord, null, 2)}\n`);
  });

  it('loads stored artifacts back through the typed schema', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-artifact-'));

    tempDirectories.push(dataRoot);

    await writeArtifactRecord(dataRoot, artifactRecord);

    await expect(loadArtifactRecord(dataRoot, artifactRecord.repoId, artifactRecord.id)).resolves.toEqual(artifactRecord);
  });

  it('rejects invalid path segments for artifact storage', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-artifact-'));

    tempDirectories.push(dataRoot);

    await expect(
      writeArtifactRecord(dataRoot, {
        ...artifactRecord,
        repoId: '../outside'
      })
    ).rejects.toThrow(/path segment/i);

    await expect(loadArtifactRecord(dataRoot, 'meta-harness', '../artifact-001')).rejects.toThrow(/path segment/i);
  });

  it('rejects invalid artifact records on write', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'meta-harness-core-artifact-'));

    tempDirectories.push(dataRoot);

    await expect(
      writeArtifactRecord(dataRoot, {
        ...artifactRecord,
        outcome: 'failure',
        failureReason: undefined
      } as ArtifactRecord)
    ).rejects.toThrow(/failureReason/i);
  });
});
