import { describe, expect, it } from 'vitest';

import { createPrepareSessionPacketPolicyInput } from '../../src/index';
import { baselineCandidate } from './candidate.test';

describe('candidate policy input adapter', () => {
  it('projects a candidate policy into prepare-session packet policy input', () => {
    expect(createPrepareSessionPacketPolicyInput(baselineCandidate)).toEqual(baselineCandidate.policy);
  });
});
