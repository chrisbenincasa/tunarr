import { tag } from '@tunarr/types';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import type { MediaSourceId } from '../db/schema/base.ts';
import type { MediaSourceLibrary } from '../db/schema/MediaSourceLibrary.ts';
import {
  type LibraryReconcileResult,
  markLibrariesUnavailable,
  reconcileLibraries,
  type ReportedLibrary,
} from './reconcileLibraries.ts';

const mediaSourceId = tag<MediaSourceId>(v4());
const now = new Date('2026-09-12T12:00:00Z');

function storedLibrary(
  overrides: Partial<MediaSourceLibrary> = {},
): MediaSourceLibrary {
  return {
    uuid: v4(),
    name: 'Movies',
    mediaType: 'movies',
    mediaSourceId,
    lastScannedAt: null,
    externalKey: '1',
    enabled: true,
    unavailableSince: null,
    ...overrides,
  };
}

function reportedLibrary(
  overrides: Partial<ReportedLibrary> = {},
): ReportedLibrary {
  return {
    externalKey: '1',
    name: 'Movies',
    mediaType: 'movies',
    ...overrides,
  };
}

function expectReconciled(result: LibraryReconcileResult) {
  if (result.type !== 'reconciled') {
    throw new Error(`Expected a reconciled result, got ${result.type}`);
  }
  return result;
}

describe('reconcileLibraries', () => {
  test('marks a library missing from the report unavailable instead of deleting it', () => {
    const movies = storedLibrary({ externalKey: '1' });
    const shows = storedLibrary({
      externalKey: '2',
      name: 'Shows',
      mediaType: 'shows',
    });

    const result = expectReconciled(
      reconcileLibraries(
        { uuid: mediaSourceId, libraries: [movies, shows] },
        [reportedLibrary({ externalKey: '1' })],
        now,
      ),
    );

    expect(result.unavailableLibraries).toEqual([
      { uuid: shows.uuid, unavailableSince: now },
    ]);
    expect(result.duplicateLibraries).toEqual([]);
    expect(result.addedLibraries).toEqual([]);
    expect(result.availableLibraries).toEqual([]);
  });

  test('marks a returning library available without touching enabled', () => {
    const library = storedLibrary({
      enabled: false,
      unavailableSince: new Date('2026-09-01T00:00:00Z'),
    });

    const result = expectReconciled(
      reconcileLibraries(
        { uuid: mediaSourceId, libraries: [library] },
        [reportedLibrary()],
        now,
      ),
    );

    expect(result.availableLibraries).toEqual([library.uuid]);
    expect(result.unavailableLibraries).toEqual([]);
    expect(result.updatedLibraries).toEqual([]);
  });

  test('skips reconciliation when the report is empty but libraries are stored', () => {
    const result = reconcileLibraries(
      { uuid: mediaSourceId, libraries: [storedLibrary()] },
      [],
      now,
    );

    expect(result).toEqual({ type: 'empty_response' });
  });

  test('reconciles an empty report when nothing is stored', () => {
    const result = expectReconciled(
      reconcileLibraries({ uuid: mediaSourceId, libraries: [] }, [], now),
    );

    expect(result.addedLibraries).toEqual([]);
  });

  test('adds new libraries disabled', () => {
    const result = expectReconciled(
      reconcileLibraries(
        { uuid: mediaSourceId, libraries: [storedLibrary()] },
        [
          reportedLibrary(),
          reportedLibrary({
            externalKey: '2',
            name: 'Music',
            mediaType: 'tracks',
          }),
        ],
        now,
      ),
    );

    expect(result.addedLibraries).toEqual([
      expect.objectContaining({
        mediaSourceId,
        externalKey: '2',
        name: 'Music',
        mediaType: 'tracks',
        enabled: false,
      }),
    ]);
  });

  test('does not re-mark a library that is already unavailable', () => {
    const library = storedLibrary({
      unavailableSince: new Date('2026-09-01T00:00:00Z'),
    });
    const other = storedLibrary({ externalKey: '2' });

    const result = expectReconciled(
      reconcileLibraries(
        { uuid: mediaSourceId, libraries: [library, other] },
        [reportedLibrary({ externalKey: '2' })],
        now,
      ),
    );

    expect(result.unavailableLibraries).toEqual([]);
    expect(result.availableLibraries).toEqual([]);
  });

  test('syncs renamed libraries', () => {
    const library = storedLibrary({ name: 'Old Name' });

    const result = expectReconciled(
      reconcileLibraries(
        { uuid: mediaSourceId, libraries: [library] },
        [reportedLibrary({ name: 'New Name' })],
        now,
      ),
    );

    expect(result.updatedLibraries).toEqual([
      { uuid: library.uuid, name: 'New Name', mediaType: 'movies' },
    ]);
  });

  test('keeps the enabled row of duplicate libraries', () => {
    const disabled = storedLibrary({ enabled: false });
    const enabled = storedLibrary({ enabled: true });

    const result = expectReconciled(
      reconcileLibraries(
        { uuid: mediaSourceId, libraries: [disabled, enabled] },
        [reportedLibrary()],
        now,
      ),
    );

    expect(result.duplicateLibraries).toEqual([
      { keepUuid: enabled.uuid, duplicateUuids: [disabled.uuid] },
    ]);
    expect(result.addedLibraries).toEqual([]);
    expect(result.unavailableLibraries).toEqual([]);
  });
});

describe('markLibrariesUnavailable', () => {
  test('marks every library that is not already unavailable', () => {
    const movies = storedLibrary({ externalKey: '1' });
    const shows = storedLibrary({ externalKey: '2', name: 'Shows' });

    const update = markLibrariesUnavailable(
      { uuid: mediaSourceId, libraries: [movies, shows] },
      now,
    );

    expect(update.unavailableLibraries).toEqual([
      { uuid: movies.uuid, unavailableSince: now },
      { uuid: shows.uuid, unavailableSince: now },
    ]);
  });

  test('leaves an already unavailable library at its original timestamp', () => {
    const earlier = new Date('2026-09-01T00:00:00Z');
    const library = storedLibrary({ unavailableSince: earlier });

    const update = markLibrariesUnavailable(
      { uuid: mediaSourceId, libraries: [library] },
      now,
    );

    expect(update.unavailableLibraries).toEqual([]);
  });

  test('never deletes duplicates, because an auth failure says nothing about them', () => {
    const keep = storedLibrary({ externalKey: '1', enabled: true });
    const duplicate = storedLibrary({ externalKey: '1', enabled: false });

    const update = markLibrariesUnavailable(
      { uuid: mediaSourceId, libraries: [keep, duplicate] },
      now,
    );

    expect(update.duplicateLibraries).toEqual([]);
    expect(update.addedLibraries).toEqual([]);
    expect(update.availableLibraries).toEqual([]);
  });
});
