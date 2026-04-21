import { describe, expect, it } from 'vitest';

import {
  prepareSessionPacket,
  type ArtifactRecord,
  type MemoryRecord,
  type PrepareSessionPacketInput,
  type SessionPacketRoute
} from '../src/index';

function createMemoryRecord(overrides: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'value'>): MemoryRecord {
  const { id, value, ...rest } = overrides;

  return {
    scope: 'repo-local',
    repoId: 'repo-a',
    kind: 'summary',
    source: 'human-input',
    sourceArtifactIds: [],
    confidence: 'high',
    createdAt: '2026-04-10T12:00:00.000Z',
    updatedAt: '2026-04-10T12:00:00.000Z',
    ...rest,
    id,
    value
  };
}

function createArtifactRecord(overrides: Partial<ArtifactRecord> & Pick<ArtifactRecord, 'id'>): ArtifactRecord {
  const { id, ...rest } = overrides;

  return {
    taskType: 'analysis',
    repoId: 'repo-a',
    promptSummary: 'Inspect the repository',
    filesInspected: ['README.md'],
    filesChanged: [],
    commands: ['pnpm test'],
    diagnostics: [],
    verification: ['pnpm test'],
    outcome: 'success',
    tags: ['repo', 'inspection'],
    createdAt: '2026-04-10T12:00:00.000Z',
    ...rest,
    id
  };
}

function createInput(prompt: string, routeHints: SessionPacketRoute[] = []): PrepareSessionPacketInput {
  return {
    packetId: `packet-${routeHints[0] ?? 'default'}`,
    repoId: 'repo-a',
    prompt,
    routeHints,
    memoryRecords: [
      createMemoryRecord({ id: 'memory-1', value: 'Inspect package.json first', updatedAt: '2026-04-21T10:00:00.000Z' }),
      createMemoryRecord({ id: 'memory-2', value: 'Run build verification after edits', updatedAt: '2026-04-20T10:00:00.000Z' }),
      createMemoryRecord({ id: 'memory-3', value: 'Ask about release target when unclear', updatedAt: '2026-04-19T10:00:00.000Z' })
    ],
    artifactRecords: [
      createArtifactRecord({ id: 'artifact-1', taskType: 'analysis', tags: ['repo', 'inspection'] }),
      createArtifactRecord({ id: 'artifact-2', taskType: 'verification', tags: ['verify', 'test'], promptSummary: 'Verify the test suite' }),
      createArtifactRecord({ id: 'artifact-3', taskType: 'codegen', tags: ['implement', 'feature'], promptSummary: 'Implement the missing endpoint' })
    ],
    referenceTime: '2026-04-21T12:00:00.000Z'
  };
}

describe('prepareSessionPacket', () => {
  it('bounds selected memories and artifacts and includes rationale', () => {
    const packet = prepareSessionPacket({
      ...createInput('Investigate the repo structure and explain the key modules.'),
      maxMemories: 2,
      maxArtifacts: 1
    });

    expect(packet.selectedMemoryIds).toHaveLength(2);
    expect(packet.selectedArtifactIds).toHaveLength(1);
    expect(packet.rationale).toMatch(/repo-a/i);
    expect(packet.rationale).toMatch(/task type/i);
  });

  it.each([
    {
      expectedRoute: 'explain',
      prompt: 'Explain how the caching layer works.',
      routeHints: []
    },
    {
      expectedRoute: 'explore',
      prompt: 'Explore the repo and identify the main entry points.',
      routeHints: []
    },
    {
      expectedRoute: 'plan',
      prompt: 'Plan the migration steps for the config format.',
      routeHints: []
    },
    {
      expectedRoute: 'implement',
      prompt: 'Implement the missing retry logic.',
      routeHints: []
    },
    {
      expectedRoute: 'verify',
      prompt: 'Verify that the build and tests pass after the fix.',
      routeHints: []
    },
    {
      expectedRoute: 'ask',
      prompt: 'The acceptance criteria are unclear and missing details.',
      routeHints: []
    },
    {
      expectedRoute: 'challenge',
      prompt: 'Challenge the assumption that we need a rewrite.',
      routeHints: []
    }
  ] satisfies Array<{ expectedRoute: SessionPacketRoute; prompt: string; routeHints: SessionPacketRoute[] }>)('recommends $expectedRoute packets', ({ expectedRoute, prompt, routeHints }) => {
    const packet = prepareSessionPacket(createInput(prompt, routeHints));

    expect(packet.suggestedRoute).toBe(expectedRoute);
    expect(packet.verificationChecklist.length).toBeGreaterThan(0);
  });

  it('uses retrieved evidence to tailor the verification checklist', () => {
    const packet = prepareSessionPacket({
      ...createInput('Implement a fix for the broken build and verify it.'),
      memoryRecords: [
        createMemoryRecord({
          id: 'memory-build',
          value: 'After TypeScript fixes, run pnpm build and capture output',
          updatedAt: '2026-04-21T11:00:00.000Z'
        })
      ],
      artifactRecords: [
        createArtifactRecord({
          id: 'artifact-build',
          taskType: 'fix',
          promptSummary: 'Fix the TypeScript build',
          verification: ['pnpm build', 'pnpm test'],
          tags: ['build', 'typescript', 'success']
        })
      ]
    });

    expect(packet.verificationChecklist.join('\n')).toMatch(/pnpm build/i);
    expect(packet.selectedArtifactIds).toEqual(['artifact-build']);
    expect(packet.selectedMemoryIds).toEqual(['memory-build']);
  });
});
