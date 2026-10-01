import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import type { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import { scannableLibraries } from './FileSystemScanner.ts';

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

describe('scannableLibraries', () => {
  test('skips the paths the user removed, which keep their library row', () => {
    const removedAt = new Date('2026-09-01T00:00:00Z');
    const kept = library('/media/movies');
    const removed = library('/media/shows', removedAt);

    expect(scannableLibraries([kept, removed])).toEqual([kept]);
  });

  test('keeps every path that is still configured', () => {
    const first = library('/media/movies');
    const second = library('/media/shows');

    expect(scannableLibraries([first, second])).toEqual([first, second]);
  });

  test('has nothing to scan when every path was removed', () => {
    expect(scannableLibraries([library('/media/shows', new Date())])).toEqual(
      [],
    );
  });
});
