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
import type { Kysely } from 'kysely';

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

describe('MediaSourceDB', () => {
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
