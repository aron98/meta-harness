import {
  inspectRetrieval,
  type InspectRetrievalInput,
  type RetrievalInspection
} from '@meta-harness/core';

export type InspectHostRetrievalInput = InspectRetrievalInput;
export type InspectHostRetrievalResult = RetrievalInspection;

export function inspectHostRetrieval(input: InspectHostRetrievalInput): InspectHostRetrievalResult {
  return inspectRetrieval(input);
}
