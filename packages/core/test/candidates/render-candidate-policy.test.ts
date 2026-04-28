import { describe, expect, it } from 'vitest';

import { renderCandidatePolicySnapshot } from '../../src/index';
import { baselineCandidate } from './candidate.test';

describe('renderCandidatePolicySnapshot', () => {
  it('renders deterministic code-like candidate policy snapshots', () => {
    expect(renderCandidatePolicySnapshot(baselineCandidate)).toBe(`// Generated candidate policy snapshot for inspection only.\nexport const candidatePolicy = ${JSON.stringify(baselineCandidate.policy, null, 2)};\n`);
  });
});
