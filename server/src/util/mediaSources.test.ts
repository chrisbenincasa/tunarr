import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import type { MediaSourceLibrary } from '../db/schema/MediaSourceLibrary.ts';
import { configuredLibraries, localSourcePaths } from './mediaSources.ts';

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

describe('configuredLibraries', () => {
  test('drops the paths the user removed, which keep their library row', () => {
    const removedAt = new Date('2026-09-01T00:00:00Z');
    const kept = library('/media/movies');
    const removed = library('/media/shows', removedAt);

    expect(configuredLibraries([kept, removed])).toEqual([kept]);
  });

  test('keeps every library that is still configured', () => {
    const first = library('/media/movies');
    const second = library('/media/shows');

    expect(configuredLibraries([first, second])).toEqual([first, second]);
  });

  test('is empty when every path was removed', () => {
    expect(configuredLibraries([library('/media/shows', new Date())])).toEqual(
      [],
    );
  });
});

describe('localSourcePaths', () => {
  test('lists the configured paths in library order', () => {
    expect(
      localSourcePaths([library('/media/movies'), library('/media/shows')]),
    ).toEqual(['/media/movies', '/media/shows']);
  });

  test('leaves out a path the user removed', () => {
    expect(
      localSourcePaths([
        library('/media/movies'),
        library('/media/shows', new Date('2026-09-01T00:00:00Z')),
      ]),
    ).toEqual(['/media/movies']);
  });

  test('is empty for a source with no libraries', () => {
    expect(localSourcePaths([])).toEqual([]);
  });
});
