import { parseCandidate, type Candidate } from './candidate';

export function renderCandidatePolicySnapshot(candidateInput: Candidate): string {
  const candidate = parseCandidate(candidateInput);

  return `// Generated candidate policy snapshot for inspection only.\nexport const candidatePolicy = ${JSON.stringify(candidate.policy, null, 2)};\n`;
}
