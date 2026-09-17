import { tag } from '@tunarr/types';
import type { Kysely } from 'kysely';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { describe, expect, test as baseTest } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import type {
  MediaSourceId,
  MediaSourceName,
  MediaSourceType,
} from '../../db/schema/base.ts';
import type { DB } from '../../db/schema/db.ts';
import { setGlobalOptionsUnchecked } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { FixMislabeledGroupingExternalIdSourceType } from './FixMislabeledGroupingExternalIdSourceType.ts';

const test = baseTest.extend<{ db: Kysely<DB> }>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    const kysely = DBAccess.instance.db;
    if (!kysely) {
      throw new Error('Expected Kysely DB connection to be initialized');
    }
    await use(kysely);
    await DBAccess.instance.closeConnection(`${dbResult.path}/db.db`);
    await dbResult.cleanup();
  },
});

async function insertMediaSource(db: Kysely<DB>, type: MediaSourceType) {
  const uuid = tag<MediaSourceId>(v4());
  await db
    .insertInto('mediaSource')
    .values({
      uuid,
      name: tag<MediaSourceName>(`${type}-${uuid}`),
      type,
      uri: 'http://localhost',
      index: 0,
      accessToken: '',
    })
    .execute();
  return uuid;
}

async function insertShow(db: Kysely<DB>, mediaSourceId: MediaSourceId) {
  const uuid = v4();
  await db
    .insertInto('programGrouping')
    .values({ uuid, title: 'Show', type: 'show', mediaSourceId })
    .execute();
  return uuid;
}

async function insertExternalId(
  db: Kysely<DB>,
  groupUuid: string,
  mediaSourceId: MediaSourceId,
  sourceType: 'plex' | 'jellyfin' | 'emby',
) {
  const uuid = v4();
  await db
    .insertInto('programGroupingExternalId')
    .values({ uuid, groupUuid, mediaSourceId, sourceType, externalKey: uuid })
    .execute();
  return uuid;
}

async function sourceTypeOf(db: Kysely<DB>, uuid: string) {
  const row = await db
    .selectFrom('programGroupingExternalId')
    .where('uuid', '=', uuid)
    .select('sourceType')
    .executeTakeFirstOrThrow();
  return row.sourceType;
}

describe('FixMislabeledGroupingExternalIdSourceType', () => {
  test('relabels plex-labelled external IDs from Jellyfin and Emby sources', async ({
    db,
  }) => {
    const jellyfin = await insertMediaSource(db, 'jellyfin');
    const emby = await insertMediaSource(db, 'emby');
    const jellyfinRow = await insertExternalId(
      db,
      await insertShow(db, jellyfin),
      jellyfin,
      'plex',
    );
    const embyRow = await insertExternalId(
      db,
      await insertShow(db, emby),
      emby,
      'plex',
    );

    await new FixMislabeledGroupingExternalIdSourceType(db).run();

    expect(await sourceTypeOf(db, jellyfinRow)).toBe('jellyfin');
    expect(await sourceTypeOf(db, embyRow)).toBe('emby');
  });

  test('leaves external IDs from real Plex sources alone', async ({ db }) => {
    const plex = await insertMediaSource(db, 'plex');
    const row = await insertExternalId(
      db,
      await insertShow(db, plex),
      plex,
      'plex',
    );

    await new FixMislabeledGroupingExternalIdSourceType(db).run();

    expect(await sourceTypeOf(db, row)).toBe('plex');
  });

  test('skips a mislabelled row when a correct row already exists for the grouping', async ({
    db,
  }) => {
    const jellyfin = await insertMediaSource(db, 'jellyfin');
    const show = await insertShow(db, jellyfin);
    const correct = await insertExternalId(db, show, jellyfin, 'jellyfin');
    const mislabelled = await insertExternalId(db, show, jellyfin, 'plex');

    await expect(
      new FixMislabeledGroupingExternalIdSourceType(db).run(),
    ).resolves.toBeUndefined();

    expect(await sourceTypeOf(db, correct)).toBe('jellyfin');
    expect(await sourceTypeOf(db, mislabelled)).toBe('plex');
  });
});
