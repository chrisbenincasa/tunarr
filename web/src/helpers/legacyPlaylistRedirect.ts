import { isNonEmptyString } from '@tunarr/shared/util';
import type { NavigateOptions } from '@tanstack/react-router';

// Maps the path after /library/custom-shows/ to the matching playlists page.
// Unknown paths fall back to the playlist list.
export function legacyPlaylistRedirect(
  splat: string | undefined,
): NavigateOptions {
  const [first, second, ...rest] = (splat ?? '')
    .split('/')
    .filter(isNonEmptyString);

  if (!first || rest.length > 0) {
    return { to: '/library/playlists' };
  }

  if (first === 'new') {
    switch (second) {
      case undefined:
        return { to: '/library/playlists/new' };
      case 'programming':
        return { to: '/library/playlists/new/programming' };
      default:
        return { to: '/library/playlists' };
    }
  }

  const params = { showId: first };
  switch (second) {
    case undefined:
      return { to: '/library/playlists/$showId', params };
    case 'edit':
      return { to: '/library/playlists/$showId/edit', params };
    case 'programming':
      return { to: '/library/playlists/$showId/programming', params };
    default:
      return { to: '/library/playlists' };
  }
}
