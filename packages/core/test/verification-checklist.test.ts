import { describe, expect, it } from 'vitest';

import { buildVerificationChecklist, type ArtifactRecord, type MemoryRecord } from '../src/index';

const artifact: ArtifactRecord = {
  id: 'artifact-1',
  taskType: 'fix',
  repoId: 'repo-a',
  promptSummary: 'Fix build',
  filesInspected: [],
  filesChanged: [],
  commands: ['pnpm test'],
  diagnostics: [],
  verification: ['pnpm build'],
  outcome: 'success',
  tags: ['build'],
  createdAt: '2026-04-21T12:00:00.000Z'
};

const memory: MemoryRecord = {
  id: 'memory-1',
  scope: 'repo-local',
  repoId: 'repo-a',
  kind: 'summary',
  value: 'Run pnpm test after build fixes',
  source: 'human-input',
  sourceArtifactIds: [],
  confidence: 'high',
  createdAt: '2026-04-21T12:00:00.000Z',
  updatedAt: '2026-04-21T12:00:00.000Z'
};

describe('buildVerificationChecklist', () => {
  it('keeps current checklist behavior by default', () => {
    const checklist = buildVerificationChecklist({
      taskType: 'fix',
      prompt: 'The acceptance criteria are unclear.',
      selectedArtifacts: [artifact],
      selectedMemories: [memory]
    });

    expect(checklist.join('\n')).toMatch(/pnpm build/i);
    expect(checklist.join('\n')).toMatch(/pnpm test/i);
    expect(checklist.join('\n')).toMatch(/Confirm unresolved assumptions/i);
  });

  it('respects candidate verification toggles', () => {
    const checklist = buildVerificationChecklist({
      taskType: 'fix',
      prompt: 'The acceptance criteria are unclear.',
      selectedArtifacts: [artifact],
      selectedMemories: [memory],
      policy: {
        includeArtifactVerificationCommands: false,
        includeMemoryCommandHints: false,
        requirePromptClarificationOnUnclear: false
      }
    });

    expect(checklist.join('\n')).not.toMatch(/pnpm build/i);
    expect(checklist.join('\n')).not.toMatch(/pnpm test/i);
    expect(checklist.join('\n')).not.toMatch(/Confirm unresolved assumptions/i);
  });
});
