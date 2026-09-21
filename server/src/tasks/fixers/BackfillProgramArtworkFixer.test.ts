import { tag } from '@tunarr/types';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { describe, expect, test as baseTest } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import { Artwork } from '../../db/schema/Artwork.ts';
import type { MediaSourceId, MediaSourceName } from '../../db/schema/base.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { MediaSource } from '../../db/schema/MediaSource.ts';
import { Program } from '../../db/schema/Program.ts';
import { setGlobalOptionsUnchecked } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { BackfillProgramArtworkFixer } from './BackfillProgramArtworkFixer.ts';

type Fixture = {
  db: string;
  drizzle: DrizzleDBAccess;
  fixer: BackfillProgramArtworkFixer;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'error',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    await use(dbResult.path);
    await DBAccess.instance.closeConnection(`${dbResult.path}/db.db`);
    await dbResult.cleanup();
  },
  drizzle: async ({ db: _ }, use) => {
    const drizzle = DBAccess.instance.drizzle;
    if (!drizzle) {
      throw new Error('Expected Drizzle DB connection to be initialized');
    }
    await use(drizzle);
  },
  fixer: async ({ drizzle }, use) => {
    await use(new BackfillProgramArtworkFixer(drizzle));
  },
});

function makeMediaSource(
  drizzle: DrizzleDBAccess,
  uri: string = 'http://plex.local:32400',
): MediaSourceId {
  const mediaSourceId = tag<MediaSourceId>(v4());
  drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      name: tag<MediaSourceName>(`Test Plex ${mediaSourceId}`),
      type: 'plex',
      uri,
      index: 0,
      accessToken: 'token',
      mediaType: 'movies',
    })
    .run();
  return mediaSourceId;
}

// (source_type, media_source_id, external_key) is unique, so every call needs
// its own key prefix.
function makePrograms(
  drizzle: DrizzleDBAccess,
  mediaSourceId: MediaSourceId,
  count: number,
  prefix: string = v4(),
) {
  for (let i = 0; i < count; i++) {
    drizzle
      .insert(Program)
      .values({
        uuid: v4(),
        duration: 30_000,
        type: 'movie',
        sourceType: 'plex',
        externalKey: `${prefix}-${i}`,
        externalSourceId: tag<MediaSourceName>('test-source'),
        title: `Test Movie ${i}`,
        mediaSourceId,
      })
      .run();
  }
}

function artworkCount(drizzle: DrizzleDBAccess): number {
  return drizzle.select().from(Artwork).all().length;
}

describe('BackfillProgramArtworkFixer', () => {
  test('backfills artwork for programs that have none', async ({
    drizzle,
    fixer,
  }) => {
    const mediaSourceId = makeMediaSource(drizzle);
    makePrograms(drizzle, mediaSourceId, 5, 'key');

    expect(artworkCount(drizzle)).toBe(0);

    await fixer.run();

    expect(artworkCount(drizzle)).toBe(5);

    const rows = drizzle.select().from(Artwork).all();
    for (const row of rows) {
      expect(row.artworkType).toBe('poster');
      expect(row.sourcePath).toMatch(
        /^http:\/\/plex\.local:32400\/library\/metadata\/key-\d+\/thumb$/,
      );
    }
  });

  test('is idempotent across runs', async ({ drizzle, fixer }) => {
    const mediaSourceId = makeMediaSource(drizzle);
    makePrograms(drizzle, mediaSourceId, 3);

    await fixer.run();
    expect(artworkCount(drizzle)).toBe(3);

    // The second run re-reads, finds every program already covered by the
    // isNull(Artwork.uuid) predicate, and writes nothing further.
    await fixer.run();
    expect(artworkCount(drizzle)).toBe(3);
  });

  test('resumes across runs, picking up programs added later', async ({
    drizzle,
    fixer,
  }) => {
    const mediaSourceId = makeMediaSource(drizzle);
    makePrograms(drizzle, mediaSourceId, 2);

    await fixer.run();
    expect(artworkCount(drizzle)).toBe(2);

    makePrograms(drizzle, mediaSourceId, 3);

    await fixer.run();
    expect(artworkCount(drizzle)).toBe(5);
  });

  test('pages past a batch boundary', async ({ drizzle, fixer }) => {
    const mediaSourceId = makeMediaSource(drizzle);
    // More than one SELECT batch (500), so the uuid cursor has to advance for
    // every program to be reached in a single run.
    makePrograms(drizzle, mediaSourceId, 501);

    await fixer.run();

    expect(artworkCount(drizzle)).toBe(501);
  });

  test('skips programs whose media source has an unusable uri', async ({
    drizzle,
    fixer,
  }) => {
    // A media source with no uri cannot have an artwork URL built for it. Those
    // programs stay unbackfilled and must not stop the scan reaching the rest.
    const unusableId = makeMediaSource(drizzle, '');
    makePrograms(drizzle, unusableId, 3);

    const mediaSourceId = makeMediaSource(drizzle);
    makePrograms(drizzle, mediaSourceId, 2);

    await fixer.run();

    expect(artworkCount(drizzle)).toBe(2);
  });
});
