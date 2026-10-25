import { tag } from '@tunarr/types';
import { eq } from 'drizzle-orm';
import { instance, mock } from 'ts-mockito';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { describe, expect, test as baseTest } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import type { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import { setGlobalOptionsUnchecked } from '../globals.ts';
import type { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';
import { copyPreMigratedDb } from '../testing/testDbFactory.ts';
import { DBAccess } from './DBAccess.ts';
import { MediaSourceDB } from './mediaSourceDB.ts';
import { ProgramStateRepository } from './program/ProgramStateRepository.ts';
import type { MediaSourceId, MediaSourceName } from './schema/base.ts';
import type { DB } from './schema/db.ts';
import type { DrizzleDBAccess } from './schema/index.ts';
import { MediaSource } from './schema/MediaSource.ts';
import { MediaSourceLibrary } from './schema/MediaSourceLibrary.ts';
import { Program } from './schema/Program.ts';
import { ProgramGrouping } from './schema/ProgramGrouping.ts';
import { eq } from 'drizzle-orm';
import type { Kysely } from 'kysely';
import type { MediaSourceLibrariesUpdate } from './mediaSourceDB.ts';

type Fixture = {
  db: string;
  drizzle: DrizzleDBAccess;
  kysely: Kysely<DB>;
  mediaSourceDB: MediaSourceDB;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    await use(dbResult.path);
    // Close the database connection before cleanup
    const dbPath = `${dbResult.path}/db.db`;
    await DBAccess.instance.closeConnection(dbPath);
    await dbResult.cleanup();
  },
  drizzle: async ({ db: _ }, use) => {
    const drizzle = DBAccess.instance.drizzle;
    if (!drizzle) {
      throw new Error('Expected Drizzle DB connection to be initialized');
    }
    await use(drizzle);
  },
  kysely: async ({ db: _ }, use) => {
    const kysely = DBAccess.instance.db;
    if (!kysely) {
      throw new Error('Expected Kysely DB connection to be initialized');
    }
    await use(kysely);
  },
  mediaSourceDB: async ({ drizzle, kysely }, use) => {
    await use(
      new MediaSourceDB(
        () => instance(mock<MediaSourceApiFactory>()),
        kysely,
        () => instance(mock<MediaSourceLibraryRefresher>()),
        drizzle,
        new ProgramStateRepository(drizzle),
      ),
    );
  },
});

function makeLibrary(
  mediaSourceId: MediaSourceId,
  path: string,
): typeof MediaSourceLibrary.$inferInsert {
  return {
    uuid: v4(),
    name: path,
    mediaType: 'movies',
    mediaSourceId,
    lastScannedAt: null,
    externalKey: path,
    enabled: true,
  };
}

function makeLocalMediaSource(drizzle: DrizzleDBAccess, paths: string[]) {
  const mediaSourceId = tag<MediaSourceId>(v4());
  drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      name: tag<MediaSourceName>('Test Local Media Source'),
      type: 'local',
      uri: '',
      index: 0,
      accessToken: '',
      mediaType: 'movies',
    })
    .run();

  drizzle
    .insert(MediaSourceLibrary)
    .values(paths.map((path) => makeLibrary(mediaSourceId, path)))
    .run();

  return mediaSourceId;
}

function makePlexMediaSource(drizzle: DrizzleDBAccess) {
  const mediaSourceId = tag<MediaSourceId>(v4());
  drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      name: tag<MediaSourceName>('Test Plex Media Source'),
      type: 'plex',
      uri: 'http://localhost:32400',
      index: 0,
      accessToken: '',
    })
    .run();
  return mediaSourceId;
}

function insertPrograms(
  drizzle: DrizzleDBAccess,
  mediaSourceId: MediaSourceId,
  libraryId: string,
  count: number,
) {
  drizzle
    .insert(Program)
    .values(
      Array.from({ length: count }, () => ({
        uuid: v4(),
        duration: 1000,
        externalKey: v4(),
        externalSourceId: tag<MediaSourceName>('Test Plex Media Source'),
        mediaSourceId,
        libraryId,
        sourceType: 'plex' as const,
        title: 'Program',
        type: 'movie' as const,
      })),
    )
    .run();
}

function insertGroupings(
  drizzle: DrizzleDBAccess,
  mediaSourceId: MediaSourceId,
  libraryId: string,
  count: number,
) {
  drizzle
    .insert(ProgramGrouping)
    .values(
      Array.from({ length: count }, () => ({
        uuid: v4(),
        title: 'Season',
        type: 'season' as const,
        sourceType: 'local' as const,
        mediaSourceId,
        libraryId,
      })),
    )
    .run();
}

function programCountForLibrary(drizzle: DrizzleDBAccess, libraryId: string) {
  return drizzle
    .select()
    .from(Program)
    .where(eq(Program.libraryId, libraryId))
    .all().length;
}

const noLibraryChanges: MediaSourceLibrariesUpdate = {
  addedLibraries: [],
  updatedLibraries: [],
  unavailableLibraries: [],
  availableLibraries: [],
  duplicateLibraries: [],
};

describe('MediaSourceDB', () => {
  test('merging duplicate libraries moves their programs to the kept library', ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makePlexMediaSource(drizzle);
    const kept = makeLibrary(mediaSourceId, '1');
    const duplicate = makeLibrary(mediaSourceId, '1');
    drizzle.insert(MediaSourceLibrary).values([kept, duplicate]).run();
    insertPrograms(drizzle, mediaSourceId, kept.uuid, 2);
    insertPrograms(drizzle, mediaSourceId, duplicate.uuid, 3);

    mediaSourceDB.updateLibraries({
      ...noLibraryChanges,
      duplicateLibraries: [
        { keepUuid: kept.uuid, duplicateUuids: [duplicate.uuid] },
      ],
    });

    const libraries = drizzle.select().from(MediaSourceLibrary).all();
    expect(libraries.map((library) => library.uuid)).toEqual([kept.uuid]);
    expect(programCountForLibrary(drizzle, kept.uuid)).toBe(5);
    expect(drizzle.select().from(Program).all()).toHaveLength(5);
  });

  test('marking a library unavailable and then available keeps its programs and enabled flag', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makePlexMediaSource(drizzle);
    const library = { ...makeLibrary(mediaSourceId, '1'), enabled: false };
    drizzle.insert(MediaSourceLibrary).values(library).run();
    insertPrograms(drizzle, mediaSourceId, library.uuid, 2);

    const unavailableSince = new Date('2026-09-01T00:00:00Z');
    mediaSourceDB.updateLibraries({
      ...noLibraryChanges,
      unavailableLibraries: [{ uuid: library.uuid, unavailableSince }],
    });

    const unavailable = await mediaSourceDB.getLibrary(library.uuid);
    expect(unavailable?.unavailableSince).toEqual(unavailableSince);
    expect(unavailable?.enabled).toBe(false);
    await expect(
      mediaSourceDB.getLibraryReferenceCounts([library.uuid]),
    ).resolves.toEqual([
      { libraryId: library.uuid, programCount: 2, channelProgramCount: 0 },
    ]);

    mediaSourceDB.updateLibraries({
      ...noLibraryChanges,
      availableLibraries: [library.uuid],
    });

    const available = await mediaSourceDB.getLibrary(library.uuid);
    expect(available?.unavailableSince).toBeNull();
    expect(available?.enabled).toBe(false);
    expect(programCountForLibrary(drizzle, library.uuid)).toBe(2);
  });

  test('removing a path flags its library and moves its programs and groupings to the trash', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makeLocalMediaSource(drizzle, [
      '/media/movies',
      '/media/shows',
    ]);
    const removed = drizzle
      .select()
      .from(MediaSourceLibrary)
      .all()
      .find((library) => library.externalKey === '/media/shows')!;
    insertPrograms(drizzle, mediaSourceId, removed.uuid, 3);
    insertGroupings(drizzle, mediaSourceId, removed.uuid, 2);

    const trashed = await mediaSourceDB.updateMediaSource({
      id: mediaSourceId,
      name: tag<MediaSourceName>('Test Local Media Source'),
      type: 'local',
      mediaType: 'movies',
      pathReplacements: [],
      paths: ['/media/movies'],
    });
    expect(trashed.programIds).toHaveLength(3);
    expect(trashed.groupingIds).toHaveLength(2);

    const libraries = drizzle.select().from(MediaSourceLibrary).all();
    expect(libraries).toHaveLength(2);
    const flagged = libraries.find((library) => library.uuid === removed.uuid);
    expect(flagged?.unavailableSince).toBeInstanceOf(Date);

    // Nothing is deleted: what the removed path held is in the trash, where the
    // user can still recover it.
    const programs = drizzle
      .select()
      .from(Program)
      .where(eq(Program.libraryId, removed.uuid))
      .all();
    expect(programs).toHaveLength(3);
    expect(programs.every((program) => program.state === 'missing')).toBe(true);

    const groupings = drizzle
      .select()
      .from(ProgramGrouping)
      .where(eq(ProgramGrouping.libraryId, removed.uuid))
      .all();
    expect(groupings).toHaveLength(2);
    expect(groupings.every((grouping) => grouping.state === 'missing')).toBe(
      true,
    );
  });

  test('adding a removed path back clears its flag instead of adding a second library', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makeLocalMediaSource(drizzle, [
      '/media/movies',
      '/media/shows',
    ]);
    const removed = drizzle
      .select()
      .from(MediaSourceLibrary)
      .all()
      .find((library) => library.externalKey === '/media/shows')!;
    insertPrograms(drizzle, mediaSourceId, removed.uuid, 2);
    insertGroupings(drizzle, mediaSourceId, removed.uuid, 2);

    const update = (paths: string[]) =>
      mediaSourceDB.updateMediaSource({
        id: mediaSourceId,
        name: tag<MediaSourceName>('Test Local Media Source'),
        type: 'local',
        mediaType: 'movies',
        pathReplacements: [],
        paths,
      });

    await update(['/media/movies']);
    await update(['/media/movies', '/media/shows']);

    const libraries = drizzle.select().from(MediaSourceLibrary).all();
    expect(libraries).toHaveLength(2);
    const restored = libraries.find((library) => library.uuid === removed.uuid);
    expect(restored?.unavailableSince).toBeNull();
    expect(programCountForLibrary(drizzle, removed.uuid)).toBe(2);

    // The path coming back takes its programs and groupings out of the trash:
    // nothing else flips them, since the scan leaves unchanged folders alone.
    const programs = drizzle
      .select()
      .from(Program)
      .where(eq(Program.libraryId, removed.uuid))
      .all();
    expect(programs).toHaveLength(2);
    expect(programs.every((program) => program.state === 'ok')).toBe(true);
    const groupings = drizzle
      .select()
      .from(ProgramGrouping)
      .where(eq(ProgramGrouping.libraryId, removed.uuid))
      .all();
    expect(groupings).toHaveLength(2);
    expect(groupings.every((grouping) => grouping.state === 'ok')).toBe(true);
  });

  test('a later save does not re-trash a path that is already unavailable', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makeLocalMediaSource(drizzle, [
      '/media/movies',
      '/media/shows',
    ]);
    const removed = drizzle
      .select()
      .from(MediaSourceLibrary)
      .all()
      .find((library) => library.externalKey === '/media/shows')!;
    insertPrograms(drizzle, mediaSourceId, removed.uuid, 2);

    const save = (paths: string[], name = 'Test Local Media Source') =>
      mediaSourceDB.updateMediaSource({
        id: mediaSourceId,
        name: tag<MediaSourceName>(name),
        type: 'local',
        mediaType: 'movies',
        pathReplacements: [],
        paths,
      });

    const first = await save(['/media/movies']);
    expect(first.programIds).toHaveLength(2);
    const flaggedAt = drizzle
      .select()
      .from(MediaSourceLibrary)
      .all()
      .find((library) => library.uuid === removed.uuid)?.unavailableSince;

    // The flagged row keeps its externalKey, so a plain rename must not flag it
    // again and rewrite what is already in the trash.
    const second = await save(['/media/movies'], 'Renamed');
    expect(second).toEqual({
      programIds: [],
      groupingIds: [],
      restoredProgramIds: [],
      restoredGroupingIds: [],
    });

    const stillFlagged = drizzle
      .select()
      .from(MediaSourceLibrary)
      .all()
      .find((library) => library.uuid === removed.uuid);
    expect(stillFlagged?.unavailableSince).toEqual(flaggedAt);
    expect(programCountForLibrary(drizzle, removed.uuid)).toBe(2);
  });

  test('adding a path to a local media source creates a new library row', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makeLocalMediaSource(drizzle, ['/media/movies']);

    const trashed = await mediaSourceDB.updateMediaSource({
      id: mediaSourceId,
      name: tag<MediaSourceName>('Test Local Media Source'),
      type: 'local',
      mediaType: 'movies',
      pathReplacements: [],
      paths: ['/media/movies', '/media/shows'],
    });
    expect(trashed).toEqual({
      programIds: [],
      groupingIds: [],
      restoredProgramIds: [],
      restoredGroupingIds: [],
    });

    const remaining = drizzle
      .select({ externalKey: MediaSourceLibrary.externalKey })
      .from(MediaSourceLibrary)
      .all();
    expect(remaining.map((r) => r.externalKey).sort()).toEqual([
      '/media/movies',
      '/media/shows',
    ]);
  });

  test('getLibrary loads the parent source libraries, so a local source keeps its paths', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    // The library detail route derives a LOCAL source's `paths` from
    // `mediaSource.libraries`, and the response schema requires that array to be
    // non-empty. With the relation unloaded the route serialized `paths: []`,
    // failed schema validation and answered 500 for every local library
    // (#2200) — the bug is here, in the query, not in the converter.
    const mediaSourceId = makeLocalMediaSource(drizzle, ['/media/movies']);
    const [libraryRow] = drizzle
      .select({ uuid: MediaSourceLibrary.uuid })
      .from(MediaSourceLibrary)
      .where(eq(MediaSourceLibrary.mediaSourceId, mediaSourceId))
      .all();
    if (!libraryRow) {
      throw new Error('expected the local media source to have a library row');
    }
    const libraryId = libraryRow.uuid;

    const found = await mediaSourceDB.getLibrary(libraryId);

    expect(
      found?.mediaSource.libraries.map((library) => library.externalKey),
    ).toEqual(['/media/movies']);
  });
});
