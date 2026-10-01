import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import type { MediaSourceLibrary } from '../db/schema/MediaSourceLibrary.ts';
import { localSourcePaths } from './mediaSourcePaths.ts';

function library(
  externalKey: string,
  unavailableSince: Date | null = null,
): MediaSourceLibrary {
  return {
    uuid: v4(),
    name: externalKey,
    mediaType: 'movies',
    mediaSourceId: v4(),
    externalKey,
    enabled: true,
    lastScannedAt: null,
    unavailableSince,
  };
}

describe('localSourcePaths', () => {
  test('lists the configured paths in library order', () => {
    expect(
      localSourcePaths([library('/media/movies'), library('/media/shows')]),
    ).toEqual(['/media/movies', '/media/shows']);
  });

  test('leaves out a path the user removed', () => {
    const removedAt = new Date('2026-09-01T00:00:00Z');

    expect(
      localSourcePaths([
        library('/media/movies'),
        library('/media/shows', removedAt),
      ]),
    ).toEqual(['/media/movies']);
  });

  test('is empty for a source with no libraries', () => {
    expect(localSourcePaths([])).toEqual([]);
  });
});
