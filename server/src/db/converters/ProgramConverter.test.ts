import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { setGlobalOptions } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import type { MediaSourceMovie } from '../../types/Media.ts';
import { DBAccess } from '../DBAccess.ts';
import type { MediaSourceId } from '../schema/base.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { MediaSource } from '../schema/MediaSource.ts';
import { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import { Program } from '../schema/Program.ts';
import { ProgramConverter } from './ProgramConverter.ts';
import { ProgramDaoMinter } from './ProgramMinter.ts';

type MovieOverrides = Partial<
  Pick<MediaSourceMovie, 'audienceRating' | 'criticRating' | 'plot' | 'summary'>
>;

type Fixture = {
  db: string;
  drizzle: DrizzleDBAccess;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    setGlobalOptions({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr();
    await use(dbResult.path);
    await dbResult.cleanup();
  },
  drizzle: async ({ db: _ }, use) => {
    const drizzle = DBAccess.instance.drizzle;
    if (!drizzle) {
      throw new Error('Drizzle is not initialized');
    }

    // DBAccess is a process-wide singleton, so rows survive between tests.
    await drizzle.delete(Program);
    await use(drizzle);
  },
});

async function createLibrary(drizzle: DrizzleDBAccess) {
  const mediaSourceId = v4() as MediaSourceId;
  const [mediaSource] = await drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      name: tag(faker.string.alpha(10)),
      type: 'local',
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      uri: '',
      accessToken: '',
      index: 0,
      sendChannelUpdates: false,
      sendGuideUpdates: false,
    })
    .returning();

  const [library] = await drizzle
    .insert(MediaSourceLibrary)
    .values({
      uuid: v4(),
      name: faker.music.genre(),
      mediaSourceId,
      mediaType: 'movies',
      externalKey: faker.string.alphanumeric(10),
      enabled: true,
    })
    .returning();

  if (!mediaSource || !library) {
    throw new Error('Failed to create the media source and library');
  }
  return { mediaSource, library };
}

function makeMovie(
  mediaSourceId: string,
  libraryId: string,
  overrides: MovieOverrides,
): MediaSourceMovie {
  return {
    uuid: v4(),
    type: 'movie',
    sourceType: 'local',
    externalId: faker.string.alphanumeric(16),
    canonicalId: faker.string.alphanumeric(16),
    mediaSourceId,
    libraryId,
    identifiers: [],
    title: faker.word.words(3),
    sortTitle: faker.word.words(3),
    originalTitle: null,
    tags: [],
    year: 2001,
    releaseDate: null,
    releaseDateString: null,
    summary: null,
    plot: null,
    tagline: null,
    rating: 'PG',
    artwork: [],
    state: 'ok',
    duration: 60_000,
    ...overrides,
  };
}

async function roundTrip(drizzle: DrizzleDBAccess, overrides: MovieOverrides) {
  const { mediaSource, library } = await createLibrary(drizzle);
  const minted = new ProgramDaoMinter().mintMovie(
    mediaSource,
    library,
    makeMovie(mediaSource.uuid, library.uuid, overrides),
  );
  await drizzle.insert(Program).values(minted.program);

  const row = await drizzle.query.program.findFirst({
    where: eq(Program.uuid, minted.program.uuid),
    with: { externalIds: true },
  });
  if (!row) {
    throw new Error('Inserted program was not found');
  }

  const db = DBAccess.instance.db;
  if (!db) {
    throw new Error('Kysely is not initialized');
  }
  return new ProgramConverter(db).programDaoToTerminalProgram(row);
}

describe('movie ratings round trip', () => {
  test('keeps audience and critic ratings through the database', async ({
    drizzle,
  }) => {
    const program = await roundTrip(drizzle, {
      audienceRating: 7.8,
      criticRating: 91,
    });

    expect(program?.type).toBe('movie');
    if (program?.type !== 'movie') {
      return;
    }
    expect(program.audienceRating).toBe(7.8);
    expect(program.criticRating).toBe(91);
  });

  test('stores missing ratings as null', async ({ drizzle }) => {
    const program = await roundTrip(drizzle, {});

    expect(program?.type).toBe('movie');
    if (program?.type !== 'movie') {
      return;
    }
    expect(program.audienceRating).toBeNull();
    expect(program.criticRating).toBeNull();
  });
});

describe('movie description round trip', () => {
  test('keeps a plot stored without a summary', async ({ drizzle }) => {
    const program = await roundTrip(drizzle, {
      plot: 'A plot from Jellyfin',
      summary: null,
    });

    expect(program?.type).toBe('movie');
    if (program?.type !== 'movie') {
      return;
    }
    expect(program.plot).toBe('A plot from Jellyfin');
  });

  test('falls back to the summary when no plot is stored', async ({
    drizzle,
  }) => {
    const program = await roundTrip(drizzle, {
      plot: null,
      summary: 'A summary from Plex',
    });

    expect(program?.type).toBe('movie');
    if (program?.type !== 'movie') {
      return;
    }
    expect(program.plot).toBe('A summary from Plex');
    expect(program.summary).toBe('A summary from Plex');
  });
});
