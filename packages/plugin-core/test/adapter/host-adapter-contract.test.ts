import { describe, expect, expectTypeOf, it } from 'vitest';

import '../../src/adapter/host-adapter-contract';
import type {
  AdapterPolicyInput,
  HostAdapterContract,
  HostAdapterMetadata,
  HostCompactionInput,
  HostRetrievalInspectionInput,
  HostTaskEndInput,
  HostTaskStartInput
} from '../../src/index';

describe('HostAdapterContract', () => {
  it('defines host-neutral lifecycle operations and clean optional policy omission', () => {
    type ExampleHost = HostAdapterMetadata & {
      runtime: 'example-host';
    };

    const calls: string[] = [];
    const contract: HostAdapterContract<ExampleHost> = {
      host: {
        name: 'example-host',
        version: '1.0.0',
        runtime: 'example-host'
      },
      startTask(input: HostTaskStartInput) {
        calls.push(`start:${input.taskId}:${input.policyInput === undefined}`);
      },
      endTask(input: HostTaskEndInput) {
        calls.push(`end:${input.taskId}`);
      },
      inspectRetrieval(input: HostRetrievalInspectionInput) {
        calls.push(`inspect:${input.taskType}`);
      },
      compactSession(input: HostCompactionInput) {
        calls.push(`compact:${input.suggestedRoute}`);
      }
    };

    contract.startTask({
      repoId: 'repo-alpha',
      taskId: 'task-001',
      taskType: 'analysis',
      taskText: 'Inspect retrieval weights for the next task.'
    });
    contract.endTask({
      repoId: 'repo-alpha',
      taskId: 'task-001',
      taskType: 'analysis',
      taskText: 'Inspect retrieval weights for the next task.',
      promptSummary: 'Inspect retrieval weights',
      suggestedRoute: 'explore'
    });
    contract.inspectRetrieval({
      repoId: 'repo-alpha',
      taskId: 'task-001',
      taskType: 'analysis',
      taskText: 'Inspect retrieval weights for the next task.'
    });
    contract.compactSession({
      repoId: 'repo-alpha',
      taskId: 'task-001',
      taskText: 'Inspect retrieval weights for the next task.',
      suggestedRoute: 'verify'
    });

    expect(contract.host).toEqual({
      name: 'example-host',
      version: '1.0.0',
      runtime: 'example-host'
    });
    expect(Object.keys(contract)).toEqual(['host', 'startTask', 'endTask', 'inspectRetrieval', 'compactSession']);
    expect(calls).toEqual(['start:task-001:true', 'end:task-001', 'inspect:analysis', 'compact:verify']);

    expectTypeOf<HostTaskStartInput['policyInput']>().toEqualTypeOf<AdapterPolicyInput | undefined>();
    expectTypeOf<HostTaskEndInput['policyInput']>().toEqualTypeOf<AdapterPolicyInput | undefined>();
    expectTypeOf<HostRetrievalInspectionInput['policyInput']>().toEqualTypeOf<AdapterPolicyInput | undefined>();
    expectTypeOf<HostCompactionInput['policyInput']>().toEqualTypeOf<AdapterPolicyInput | undefined>();
  });
});
