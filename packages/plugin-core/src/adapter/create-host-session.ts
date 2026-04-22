import {
  createTaskStartContext,
  type CreateTaskStartContextInput,
  type CreateTaskStartContextResult
} from '@meta-harness/core';

import type { AdapterPolicyInput } from './adapter-policy-input';

export type CreateHostSessionInput = CreateTaskStartContextInput & {
  policyInput?: AdapterPolicyInput;
};

export type CreateHostSessionResult = CreateTaskStartContextResult;

export function createHostSession(input: CreateHostSessionInput): CreateHostSessionResult {
  return createTaskStartContext(input);
}
