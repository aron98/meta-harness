import { parseCandidate, type Candidate } from './candidate';
import type { PrepareSessionPacketPolicyInput } from '../prepare-session-packet';

export function createPrepareSessionPacketPolicyInput(candidate: Candidate): PrepareSessionPacketPolicyInput {
  return parseCandidate(candidate).policy;
}
