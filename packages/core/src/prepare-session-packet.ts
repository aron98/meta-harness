import type { ArtifactOutcome, ArtifactRecord } from './artifact-record';
import { classifyTaskType } from './task-classification';
import { rankArtifacts, rankMemories } from './retriever';
import type { RetrievalQuery } from './retrieval-query';
import { buildVerificationChecklist } from './verification-checklist';
import { parseSessionPacket, type SessionPacket, type SessionPacketRoute } from './session-packet';
import type { MemoryRecord } from './memory-record';

export type PrepareSessionPacketRetrievalPolicyInput = {
  repoMatchWeight?: number;
  tagOverlapWeight?: number;
  recentMaxBonus?: number;
  recentHalfLifeDays?: number;
  taskTypeWeight?: number;
  outcomeWeight?: number;
  taskLocalMemoryBonus?: number;
};

export type PrepareSessionPacketRoutingPolicyInput = {
  taskTypeOrder?: string[];
  buildPromptMode?: string;
};

export type PrepareSessionPacketVerificationPolicyInput = {
  includeArtifactVerificationCommands?: boolean;
  includeMemoryCommandHints?: boolean;
  requirePromptClarificationOnUnclear?: boolean;
};

export type PrepareSessionPacketPolicyInput = {
  retrieval?: PrepareSessionPacketRetrievalPolicyInput;
  routing?: PrepareSessionPacketRoutingPolicyInput;
  verification?: PrepareSessionPacketVerificationPolicyInput;
};

export type PrepareSessionPacketInput = {
  packetId: string;
  repoId: string;
  prompt: string;
  taskId?: string;
  routeHints?: SessionPacketRoute[];
  memoryRecords: readonly MemoryRecord[];
  artifactRecords: readonly ArtifactRecord[];
  maxMemories?: number;
  maxArtifacts?: number;
  preferredOutcome?: ArtifactOutcome;
  policyInput?: PrepareSessionPacketPolicyInput;
  referenceTime: string;
};

function deriveTags(prompt: string, routeHints: readonly SessionPacketRoute[]): string[] {
  const normalizedPrompt = prompt.toLowerCase();
  const tags = new Set<string>(routeHints);

  for (const token of normalizedPrompt.split(/[^a-z0-9]+/)) {
    if (token.length >= 4) {
      tags.add(token);
    }
  }

  return Array.from(tags);
}

function recommendRoute(prompt: string, routeHints: readonly SessionPacketRoute[]): SessionPacketRoute {
  for (const routeHint of routeHints) {
    return routeHint;
  }

  if (/\bchallenge\b|\bassumption\b|\brewrite\b/i.test(prompt)) {
    return 'challenge';
  }

  if (/\bunclear\b|\bmissing details\b|\bneed more info\b/i.test(prompt)) {
    return 'ask';
  }

  if (/\bexplain\b|\bhow does\b/i.test(prompt)) {
    return 'explain';
  }

  if (/\bexplore\b|\binspect\b|\binvestigate\b/i.test(prompt)) {
    return 'explore';
  }

  if (/\bplan\b|\bmigration\b|\bsteps\b/i.test(prompt)) {
    return 'plan';
  }

  if (/\bverify\b|\btest\b|\bcheck\b/i.test(prompt)) {
    return 'verify';
  }

  if (/\bimplement\b|\badd\b|\bbuild\b|\bcreate\b/i.test(prompt)) {
    return 'implement';
  }

  return 'explore';
}

function getPreferredOutcome(prompt: string, preferredOutcome: ArtifactOutcome | undefined): ArtifactOutcome | undefined {
  if (preferredOutcome !== undefined) {
    return preferredOutcome;
  }

  if (/\bfail(?:ure)?\b/i.test(prompt)) {
    return 'failure';
  }

  if (/\bsuccess\b|\bpass\b|\bworking\b/i.test(prompt)) {
    return 'success';
  }

  return undefined;
}

function buildRationale(query: RetrievalQuery, memoryIds: string[], artifactIds: string[]): string {
  return `Selected ${memoryIds.length} memories and ${artifactIds.length} artifacts for repo ${query.repoId} based on task type ${query.taskType}, structured tag overlap, and recency.`;
}

export function prepareSessionPacket(input: PrepareSessionPacketInput): SessionPacket {
  const taskType = classifyTaskType(input.prompt);
  const route = recommendRoute(input.prompt, input.routeHints ?? []);
  const query: RetrievalQuery = {
    repoId: input.repoId,
    taskType,
    tags: deriveTags(input.prompt, input.routeHints ?? []),
    preferredOutcome: getPreferredOutcome(input.prompt, input.preferredOutcome),
    referenceTime: input.referenceTime
  };

  const maxMemories = input.maxMemories ?? 3;
  const maxArtifacts = input.maxArtifacts ?? 2;
  const selectedMemories = rankMemories(query, input.memoryRecords)
    .slice(0, maxMemories)
    .map((entry) => entry.record);
  const selectedArtifacts = rankArtifacts(query, input.artifactRecords)
    .slice(0, maxArtifacts)
    .map((entry) => entry.record);

  return parseSessionPacket({
    id: input.packetId,
    repoId: input.repoId,
    taskType,
    taskId: input.taskId,
    selectedMemoryIds: selectedMemories.map((record) => record.id),
    selectedArtifactIds: selectedArtifacts.map((record) => record.id),
    suggestedRoute: route,
    verificationChecklist: buildVerificationChecklist({
      taskType,
      prompt: input.prompt,
      selectedMemories,
      selectedArtifacts
    }),
    rationale: buildRationale(
      query,
      selectedMemories.map((record) => record.id),
      selectedArtifacts.map((record) => record.id)
    ),
    createdAt: input.referenceTime
  });
}
