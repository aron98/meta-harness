import type { TaskType } from './artifact-record';

const taskTypeMatchers: Array<{ taskType: TaskType; patterns: RegExp[] }> = [
  {
    taskType: 'verification',
    patterns: [/\bverify\b/i, /\bvalidation\b/i, /\btest(?:s|ing)?\b/i, /\bcheck\b/i, /\bpass(?:es|ed|ing)?\b/i]
  },
  {
    taskType: 'planning',
    patterns: [/\bplan\b/i, /\broadmap\b/i, /\bsteps\b/i, /\bmigration\b/i]
  },
  {
    taskType: 'documentation',
    patterns: [/\bdocument(?:ation)?\b/i, /\breadme\b/i, /\bguide\b/i, /\bexplain\b/i]
  },
  {
    taskType: 'fix',
    patterns: [/\bfix\b/i, /\bbug\b/i, /\bbroken\b/i, /\brepair\b/i]
  },
  {
    taskType: 'codegen',
    patterns: [/\bimplement\b/i, /\badd\b/i, /\bcreate\b/i, /\bfeature\b/i]
  },
  {
    taskType: 'analysis',
    patterns: [/\bexplore\b/i, /\binvestigate\b/i, /\binspect\b/i, /\banaly[sz]e\b/i, /\bchallenge\b/i]
  }
];

function classifyBuildPrompt(input: string): TaskType | undefined {
  if (!/\bbuild\b/i.test(input)) {
    return undefined;
  }

  if (
    /\bbuild\s+(?:a|an|the|new|missing)\b/i.test(input) ||
    /\bbuild\s+(?:helper|feature|endpoint|component|service|module|tool|api|flow|command)\b/i.test(input)
  ) {
    return 'codegen';
  }

  if (/\b(?:verify|validation|test(?:s|ing)?|check|pass(?:es|ed|ing)?|release|pipeline|package)\b/i.test(input)) {
    return 'verification';
  }

  return undefined;
}

export function classifyTaskType(input: string): TaskType {
  const buildTaskType = classifyBuildPrompt(input);

  if (buildTaskType !== undefined) {
    return buildTaskType;
  }

  for (const candidate of taskTypeMatchers) {
    if (candidate.patterns.some((pattern) => pattern.test(input))) {
      return candidate.taskType;
    }
  }

  return 'analysis';
}
