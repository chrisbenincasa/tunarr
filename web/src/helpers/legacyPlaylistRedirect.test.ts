import { describe, expect, test } from 'vitest';
import { legacyPlaylistRedirect } from './legacyPlaylistRedirect.ts';

describe('legacyPlaylistRedirect', () => {
  test.each([
    [undefined, { to: '/library/playlists' }],
    ['', { to: '/library/playlists' }],
    ['new', { to: '/library/playlists/new' }],
    ['new/', { to: '/library/playlists/new' }],
    ['new/programming', { to: '/library/playlists/new/programming' }],
    [
      'abc-123',
      { to: '/library/playlists/$showId', params: { showId: 'abc-123' } },
    ],
    [
      'abc-123/edit',
      { to: '/library/playlists/$showId/edit', params: { showId: 'abc-123' } },
    ],
    [
      'abc-123/programming',
      {
        to: '/library/playlists/$showId/programming',
        params: { showId: 'abc-123' },
      },
    ],
  ])('maps %j', (splat, expected) => {
    expect(legacyPlaylistRedirect(splat)).toEqual(expected);
  });

  test.each(['new/edit', 'abc-123/unknown', 'abc-123/edit/extra'])(
    'falls back to the playlist list for %j',
    (splat) => {
      expect(legacyPlaylistRedirect(splat)).toEqual({
        to: '/library/playlists',
      });
    },
  );
});
