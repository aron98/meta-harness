import { describe, expect, it } from 'vitest';

import {
  parseArtifactRecord,
  parseSessionPacket,
  sessionPacketSchema,
  type ArtifactRecord,
  type SessionPacket
} from '../src/index';

const validArtifactRecord: ArtifactRecord = {
  id: 'artifact-001',
  taskType: 'codegen',
  repoId: 'meta-harness',
  taskId: 'task-123',
  promptSummary: 'Implement typed records for phase 1.',
  filesInspected: ['packages/core/src/index.ts'],
  filesChanged: ['packages/core/src/artifact-record.ts'],
  commands: ['pnpm --filter @meta-harness/core test'],
  diagnostics: ['All targeted tests passed.'],
  verification: ['pnpm --filter @meta-harness/core test'],
  outcome: 'success',
  cost: 0.12,
  latencyMs: 1450,
  tags: ['phase-1', 'records'],
  createdAt: '2026-04-21T12:00:00.000Z'
};

const validSessionPacket: SessionPacket = {
  id: 'packet-001',
  repoId: 'meta-harness',
  taskType: 'codegen',
  taskId: 'task-123',
  selectedMemoryIds: ['memory-1'],
  selectedArtifactIds: ['artifact-001'],
  suggestedRoute: 'implement',
  verificationChecklist: ['Run package tests'],
  rationale: 'Selected the latest task-local memory and artifact.',
  createdAt: '2026-04-21T12:05:00.000Z'
};

describe('parseArtifactRecord', () => {
  it('accepts a complete artifact record', () => {
    expect(parseArtifactRecord(validArtifactRecord)).toEqual(validArtifactRecord);
  });

  it('requires a non-empty failure reason for failed artifacts', () => {
    expect(() =>
      parseArtifactRecord({
        ...validArtifactRecord,
        outcome: 'failure',
        failureReason: ''
      })
    ).toThrow(/failureReason/i);
  });

  it('allows omitted failure reason for successful artifacts', () => {
    expect(parseArtifactRecord(validArtifactRecord)).toEqual(validArtifactRecord);
  });

  it('rejects invalid enum, timestamp, and negative numeric values', () => {
    expect(() =>
      parseArtifactRecord({
        ...validArtifactRecord,
        taskType: 'ship'
      })
    ).toThrow();

    expect(() =>
      parseArtifactRecord({
        ...validArtifactRecord,
        createdAt: 'not-a-timestamp'
      })
    ).toThrow();

    expect(() =>
      parseArtifactRecord({
        ...validArtifactRecord,
        latencyMs: -1
      })
    ).toThrow();
  });
});

describe('parseSessionPacket', () => {
  it('accepts a valid session packet from the package entrypoint', () => {
    expect(parseSessionPacket(validSessionPacket)).toEqual(validSessionPacket);
  });

  it('exports the session packet schema at runtime', () => {
    expect(sessionPacketSchema.safeParse(validSessionPacket).success).toBe(true);
  });
});
