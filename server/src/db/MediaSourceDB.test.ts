import { tag } from '@tunarr/types';
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
import type { MediaSourceId, MediaSourceName } from './schema/base.ts';
import type { DB } from './schema/db.ts';
import type { DrizzleDBAccess } from './schema/index.ts';
import { MediaSource } from './schema/MediaSource.ts';
import { MediaSourceLibrary } from './schema/MediaSourceLibrary.ts';
import { Program } from './schema/Program.ts';
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

  test('removing a path from a local media source deletes the library row', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makeLocalMediaSource(drizzle, [
      '/media/movies',
      '/media/shows',
    ]);

    await expect(
      mediaSourceDB.updateMediaSource({
        id: mediaSourceId,
        name: tag<MediaSourceName>('Test Local Media Source'),
        type: 'local',
        mediaType: 'movies',
        pathReplacements: [],
        paths: ['/media/movies'],
      }),
    ).resolves.toBeUndefined();

    const remaining = drizzle.select().from(MediaSourceLibrary).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.externalKey).toBe('/media/movies');
  });

  test('adding a path to a local media source creates a new library row', async ({
    mediaSourceDB,
    drizzle,
  }) => {
    const mediaSourceId = makeLocalMediaSource(drizzle, ['/media/movies']);

    await expect(
      mediaSourceDB.updateMediaSource({
        id: mediaSourceId,
        name: tag<MediaSourceName>('Test Local Media Source'),
        type: 'local',
        mediaType: 'movies',
        pathReplacements: [],
        paths: ['/media/movies', '/media/shows'],
      }),
    ).resolves.toBeUndefined();

    const remaining = drizzle
      .select({ externalKey: MediaSourceLibrary.externalKey })
      .from(MediaSourceLibrary)
      .all();
    expect(remaining.map((r) => r.externalKey).sort()).toEqual([
      '/media/movies',
      '/media/shows',
    ]);
  });
});
