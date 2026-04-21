import { describe, expect, it } from 'vitest';

import { getFixtureArtifact } from '../src/index';

describe('getFixtureArtifact', () => {
  it('returns a stable placeholder artifact shape', () => {
    expect(getFixtureArtifact()).toEqual({
      scope: 'task-local',
      status: 'placeholder',
      taskType: 'implement'
    });
  });
});
