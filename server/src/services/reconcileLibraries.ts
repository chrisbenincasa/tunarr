import type { MediaSourceLibrariesUpdate } from '../db/mediaSourceDB.ts';
import type { MediaSourceId } from '../db/schema/base.ts';
import type { MediaLibraryType } from '../db/schema/MediaSource.ts';
import type {
  MediaSourceLibrary,
  NewMediaSourceLibrary,
} from '../db/schema/MediaSourceLibrary.ts';
import { v4 } from 'uuid';

export type ReportedLibrary = {
  externalKey: string;
  name: string;
  mediaType: MediaLibraryType;
};

export type LibraryReconcileResult =
  | { type: 'empty_response' }
  | ({ type: 'reconciled' } & MediaSourceLibrariesUpdate);

type StoredMediaSource = {
  uuid: MediaSourceId;
  libraries: MediaSourceLibrary[];
};

/**
 * Diffs the libraries a media server reports against the stored ones.
 *
 * A library missing from the report is marked unavailable and never deleted,
 * because library foreign keys cascade to programs and channel schedules. The
 * only deletions are duplicate rows, whose references move to the kept row.
 */
export function reconcileLibraries(
  mediaSource: StoredMediaSource,
  reported: ReportedLibrary[],
  now: Date,
): LibraryReconcileResult {
  const { kept, duplicateLibraries } = partitionDuplicates(
    mediaSource.libraries,
  );

  // An empty report is far more likely a restricted token or a server that is
  // still starting than every library being removed at once.
  if (reported.length === 0 && kept.length > 0) {
    return { type: 'empty_response' };
  }

  const reportedByKey = new Map(
    reported.map((library) => [library.externalKey, library]),
  );
  const storedKeys = new Set(kept.map((library) => library.externalKey));

  const addedLibraries = [...reportedByKey.values()]
    .filter((library) => !storedKeys.has(library.externalKey))
    .map(
      (library) =>
        ({
          uuid: v4(),
          mediaSourceId: mediaSource.uuid,
          externalKey: library.externalKey,
          name: library.name,
          mediaType: library.mediaType,
          enabled: false,
        }) satisfies NewMediaSourceLibrary,
    );

  const update: MediaSourceLibrariesUpdate = {
    addedLibraries,
    updatedLibraries: [],
    unavailableLibraries: [],
    availableLibraries: [],
    duplicateLibraries,
  };

  for (const stored of kept) {
    const incoming = reportedByKey.get(stored.externalKey);

    if (!incoming) {
      if (stored.unavailableSince === null) {
        update.unavailableLibraries.push({
          uuid: stored.uuid,
          unavailableSince: now,
        });
      }
      continue;
    }

    if (stored.unavailableSince !== null) {
      update.availableLibraries.push(stored.uuid);
    }

    if (
      incoming.name !== stored.name ||
      incoming.mediaType !== stored.mediaType
    ) {
      update.updatedLibraries.push({
        uuid: stored.uuid,
        name: incoming.name,
        mediaType: incoming.mediaType,
      });
    }
  }

  return { type: 'reconciled', ...update };
}

/**
 * Marks every stored library of a source unavailable.
 *
 * Used when the server rejects our credentials, so it reports nothing rather
 * than a subset. Duplicates are left alone: an auth failure says nothing about
 * which rows are redundant, and this path must not delete.
 */
export function markLibrariesUnavailable(
  mediaSource: StoredMediaSource,
  now: Date,
): MediaSourceLibrariesUpdate {
  return {
    addedLibraries: [],
    updatedLibraries: [],
    unavailableLibraries: mediaSource.libraries
      .filter((library) => library.unavailableSince === null)
      .map((library) => ({ uuid: library.uuid, unavailableSince: now })),
    availableLibraries: [],
    duplicateLibraries: [],
  };
}

// Keeps one row per external key, preferring an enabled row so the user's
// choice survives the merge.
function partitionDuplicates(libraries: MediaSourceLibrary[]) {
  const keptByKey = new Map<string, MediaSourceLibrary>();
  for (const library of libraries) {
    const current = keptByKey.get(library.externalKey);
    if (current === undefined || (!current.enabled && library.enabled)) {
      keptByKey.set(library.externalKey, library);
    }
  }

  const kept = [...keptByKey.values()];
  const duplicateLibraries: MediaSourceLibrariesUpdate['duplicateLibraries'] =
    [];
  for (const keep of kept) {
    const duplicateUuids = libraries
      .filter(
        (library) =>
          library.externalKey === keep.externalKey &&
          library.uuid !== keep.uuid,
      )
      .map((library) => library.uuid);

    if (duplicateUuids.length > 0) {
      duplicateLibraries.push({ keepUuid: keep.uuid, duplicateUuids });
    }
  }

  return { kept, duplicateLibraries };
}
