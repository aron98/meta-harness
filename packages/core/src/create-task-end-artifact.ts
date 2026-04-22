import { parseArtifactRecord, type ArtifactRecord } from './artifact-record';
import { parseTaskEndEvent, type TaskEndEvent } from './task-end-event';

function buildDiagnostics(taskEnd: TaskEndEvent): string[] {
  const diagnostics = [...taskEnd.diagnostics];

  if (taskEnd.unresolvedQuestions.length > 0) {
    diagnostics.push(`Unresolved questions: ${taskEnd.unresolvedQuestions.join('; ')}`);
  }

  diagnostics.push(`Verification status: ${taskEnd.verificationState.status}`);

  return diagnostics;
}

export function createTaskEndArtifact(taskEndInput: TaskEndEvent): ArtifactRecord {
  const taskEnd = parseTaskEndEvent(taskEndInput);

  return parseArtifactRecord({
    id: taskEnd.id,
    taskType: taskEnd.taskType,
    repoId: taskEnd.repoId,
    taskId: taskEnd.taskId,
    promptSummary: taskEnd.promptSummary,
    filesInspected: taskEnd.filesInspected,
    filesChanged: taskEnd.filesChanged,
    commands: taskEnd.commands,
    diagnostics: buildDiagnostics(taskEnd),
    verification: taskEnd.verificationState.checklist,
    outcome: taskEnd.outcome,
    failureReason: taskEnd.failureReason,
    cost: taskEnd.cost,
    latencyMs: taskEnd.latencyMs,
    tags: Array.from(new Set([...taskEnd.tags, taskEnd.suggestedRoute, taskEnd.verificationState.status])),
    createdAt: taskEnd.endedAt
  });
}
