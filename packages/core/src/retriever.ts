import type { ArtifactOutcome, ArtifactRecord, TaskType } from './artifact-record';
import { parseRetrievalQuery, type RetrievalQuery } from './retrieval-query';
import type { MemoryRecord } from './memory-record';

type RankableRecord = {
  repoId?: string;
  tags?: string[];
  createdAt: string;
};

export type RetrievalReason =
  | 'repo-match'
  | 'task-type-match'
  | 'tag-overlap'
  | 'recent'
  | 'outcome-match'
  | 'scope-bonus';

export type ScoredRetrieval<T> = {
  record: T;
  score: number;
  reasons: RetrievalReason[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const textTokenStopWords = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'or',
  'the',
  'to',
  'with'
]);

function normalizeTags(tags: readonly string[] | undefined): string[] {
  return (tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !textTokenStopWords.has(token));
}

function getRecencyBonus(createdAt: string, referenceTime: string | undefined): number {
  if (referenceTime === undefined) {
    return 0;
  }

  const ageInDays = Math.max(0, (Date.parse(referenceTime) - Date.parse(createdAt)) / DAY_IN_MS);

  if (Number.isNaN(ageInDays)) {
    return 0;
  }

  return Math.max(0, 4 - Math.min(4, ageInDays / 7));
}

function scoreShared(query: RetrievalQuery, record: RankableRecord): ScoredRetrieval<RankableRecord> {
  const reasons: RetrievalReason[] = [];
  const recordTags = normalizeTags(record.tags);
  const queryTags = new Set(normalizeTags(query.tags));

  let score = 0;

  if (record.repoId === query.repoId) {
    score += 10;
    reasons.push('repo-match');
  }

  const sharedTagCount = recordTags.filter((tag) => queryTags.has(tag)).length;

  if (sharedTagCount > 0) {
    score += sharedTagCount * 3;
    reasons.push('tag-overlap');
  }

  const recencyBonus = getRecencyBonus(record.createdAt, query.referenceTime);

  if (recencyBonus > 0) {
    score += recencyBonus;
    reasons.push('recent');
  }

  return { record, score, reasons };
}

function compareRank<T>(left: ScoredRetrieval<T>, right: ScoredRetrieval<T>): number {
  return right.score - left.score;
}

export function rankMemories(queryInput: RetrievalQuery, memories: readonly MemoryRecord[]): ScoredRetrieval<MemoryRecord>[] {
  const query = parseRetrievalQuery(queryInput);

  return memories
    .map((record) => {
      const shared = scoreShared(query, {
        repoId: record.repoId,
        tags: [record.kind, record.scope, ...record.sourceArtifactIds, ...tokenizeText(record.value)],
        createdAt: record.updatedAt
      });

      let score = shared.score;
      const reasons = [...shared.reasons];

      if (record.scope === 'task-local') {
        score += 1;
        reasons.push('scope-bonus');
      }

      return {
        record,
        score,
        reasons
      };
    })
    .sort(compareRank);
}

function hasOutcomeMatch(preferredOutcome: ArtifactOutcome | undefined, record: ArtifactRecord): boolean {
  if (preferredOutcome === undefined) {
    return false;
  }

  const normalizedTags = normalizeTags(record.tags);

  return record.outcome === preferredOutcome || normalizedTags.includes(preferredOutcome);
}

function hasTaskTypeMatch(queryTaskType: TaskType, record: ArtifactRecord): boolean {
  return record.taskType === queryTaskType;
}

export function rankArtifacts(queryInput: RetrievalQuery, artifacts: readonly ArtifactRecord[]): ScoredRetrieval<ArtifactRecord>[] {
  const query = parseRetrievalQuery(queryInput);

  return artifacts
    .map((record) => {
      const shared = scoreShared(query, record);
      let score = shared.score;
      const reasons = [...shared.reasons];

      if (hasTaskTypeMatch(query.taskType, record)) {
        score += 8;
        reasons.push('task-type-match');
      }

      if (hasOutcomeMatch(query.preferredOutcome, record)) {
        score += 4;
        reasons.push('outcome-match');
      }

      return {
        record,
        score,
        reasons
      };
    })
    .sort(compareRank);
}
