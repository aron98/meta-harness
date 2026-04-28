import type { TaskType } from './artifact-record';

export type TaskClassificationPolicyInput = {
  taskTypeOrder?: readonly string[];
  buildPromptMode?: string;
};

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

function classifyBuildPrompt(input: string, policy: TaskClassificationPolicyInput | undefined): TaskType | undefined {
  if (!/\bbuild\b/i.test(input)) {
    return undefined;
  }

  if (policy?.buildPromptMode === 'prefer-codegen') {
    return 'codegen';
  }

  if (policy?.buildPromptMode === 'prefer-verification') {
    return 'verification';
  }

  if (policy?.taskTypeOrder !== undefined) {
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

function orderedMatchers(policy: TaskClassificationPolicyInput | undefined): typeof taskTypeMatchers {
  if (policy?.taskTypeOrder === undefined) {
    return taskTypeMatchers;
  }

  const matcherByTaskType = new Map(taskTypeMatchers.map((matcher) => [matcher.taskType, matcher]));
  const ordered = policy.taskTypeOrder.flatMap((taskType) => {
    const matcher = matcherByTaskType.get(taskType as TaskType);

    return matcher === undefined ? [] : [matcher];
  });
  const remaining = taskTypeMatchers.filter((matcher) => !policy.taskTypeOrder?.includes(matcher.taskType));

  return [...ordered, ...remaining];
}

export function classifyTaskType(input: string, policy?: TaskClassificationPolicyInput): TaskType {
  const buildTaskType = classifyBuildPrompt(input, policy);

  if (buildTaskType !== undefined) {
    return buildTaskType;
  }

  for (const candidate of orderedMatchers(policy)) {
    if (candidate.patterns.some((pattern) => pattern.test(input))) {
      return candidate.taskType;
    }
  }

  return 'analysis';
}
