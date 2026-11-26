import { describe, expect, test } from 'vitest';
import type { PlexTimelineReport } from './plexTimelineParams.ts';
import { buildPlexTimelineParams } from './plexTimelineParams.ts';

const installId = '6f1d3c2a-9b8e-4f7d-a1c2-3e4f5a6b7c8d';

function invocation(
  overrides: Partial<PlexTimelineReport> = {},
): PlexTimelineReport {
  return {
    ratingKey: '32695',
    startTime: 60_000,
    duration: 7_000_000,
    playState: 'playing',
    sessionId: 'session-a',
    ...overrides,
  };
}

describe('buildPlexTimelineParams', () => {
  test('sends the install ID as the client identifier', () => {
    const params = buildPlexTimelineParams(invocation(), installId);

    expect(params['X-Plex-Client-Identifier']).toBe(installId);
  });

  test('keeps the client identifier and device name the same across playbacks', () => {
    const first = buildPlexTimelineParams(
      invocation({ ratingKey: '32695', sessionId: 'session-a' }),
      installId,
    );
    const second = buildPlexTimelineParams(
      invocation({ ratingKey: '32699', sessionId: 'session-b' }),
      installId,
    );

    expect(second['X-Plex-Client-Identifier']).toBe(
      first['X-Plex-Client-Identifier'],
    );
    expect(first['X-Plex-Device-Name']).toBe('Tunarr');
    expect(second['X-Plex-Device-Name']).toBe('Tunarr');
  });

  test('gives each playback its own session identifier', () => {
    const first = buildPlexTimelineParams(
      invocation({ sessionId: 'session-a' }),
      installId,
    );
    const second = buildPlexTimelineParams(
      invocation({ sessionId: 'session-b' }),
      installId,
    );

    expect(first['X-Plex-Session-Identifier']).toBe('session-a');
    expect(second['X-Plex-Session-Identifier']).toBe('session-b');
  });

  test('reports the item, state, and position', () => {
    const params = buildPlexTimelineParams(
      invocation({ playState: 'stopped', startTime: 120_000 }),
      installId,
    );

    expect(params).toMatchObject({
      ratingKey: '32695',
      key: '/library/metadata/32695',
      state: 'stopped',
      time: 120_000,
      duration: 7_000_000,
    });
  });
});
