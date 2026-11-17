import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { setGlobalOptions } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { DBAccess } from '../DBAccess.ts';
import type { MediaSourceId, MediaSourceName } from '../schema/base.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { MediaSource } from '../schema/MediaSource.ts';
import { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import { Program } from '../schema/Program.ts';
import { ProgramSearchRepository } from './ProgramSearchRepository.ts';

type Fixture = {
  db: string;
  drizzle: DrizzleDBAccess;
  repo: ProgramSearchRepository;
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
  repo: async ({ drizzle }, use) => {
    const kysely = DBAccess.instance.db;
    if (!kysely) {
      throw new Error('Kysely is not initialized');
    }
    await use(new ProgramSearchRepository(kysely, drizzle));
  },
});

async function createLibrary(drizzle: DrizzleDBAccess): Promise<string> {
  const mediaSourceId = v4() as MediaSourceId;
  await drizzle.insert(MediaSource).values({
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
  });

  const libraryId = v4();
  await drizzle.insert(MediaSourceLibrary).values({
    uuid: libraryId,
    name: faker.music.genre(),
    mediaSourceId,
    mediaType: 'movies',
    externalKey: faker.string.alphanumeric(10),
    enabled: true,
  });
  return libraryId;
}

async function insertPrograms(
  drizzle: DrizzleDBAccess,
  libraryId: string,
  count: number,
): Promise<string[]> {
  const uuids = Array.from({ length: count }, () => v4());
  await drizzle.insert(Program).values(
    uuids.map((uuid) => ({
      uuid,
      duration: 30000,
      type: 'movie' as const,
      sourceType: 'local' as const,
      externalKey: faker.string.alphanumeric(16),
      externalSourceId: faker.string.alphanumeric(16),
      title: faker.word.words(3),
      libraryId,
    })),
  );
  return uuids;
}

describe('ProgramSearchRepository.getMediaSourceLibraryPrograms', () => {
  test('returns one page and the library total', async ({ drizzle, repo }) => {
    const libraryId = await createLibrary(drizzle);
    await insertPrograms(drizzle, libraryId, 7);

    const page = await repo.getMediaSourceLibraryPrograms(libraryId, {
      offset: 0,
      limit: 3,
    });

    expect(page.total).toBe(7);
    expect(page.results).toHaveLength(3);
  });

  test('pages through every program once, in uuid order', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const uuids = await insertPrograms(drizzle, libraryId, 7);

    const seen: string[] = [];
    for (let offset = 0; offset < 7; offset += 3) {
      const page = await repo.getMediaSourceLibraryPrograms(libraryId, {
        offset,
        limit: 3,
      });
      seen.push(...page.results.map((p) => p.uuid));
    }

    expect(seen).toEqual([...uuids].sort());
  });

  test('returns an empty page past the end', async ({ drizzle, repo }) => {
    const libraryId = await createLibrary(drizzle);
    await insertPrograms(drizzle, libraryId, 2);

    const page = await repo.getMediaSourceLibraryPrograms(libraryId, {
      offset: 10,
      limit: 3,
    });

    expect(page.total).toBe(2);
    expect(page.results).toEqual([]);
  });

  test('counts and returns only programs in the requested library', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const otherLibraryId = await createLibrary(drizzle);
    const uuids = await insertPrograms(drizzle, libraryId, 2);
    await insertPrograms(drizzle, otherLibraryId, 5);

    const page = await repo.getMediaSourceLibraryPrograms(libraryId, {
      offset: 0,
      limit: 100,
    });

    expect(page.total).toBe(2);
    expect(page.results.map((p) => p.uuid).sort()).toEqual([...uuids].sort());
  });
});

describe('ProgramSearchRepository.getProgramInfoForMediaSourceLibrary', () => {
  test('returns each program state so scanners can restore trashed ones', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    await drizzle.insert(Program).values(
      (['ok', 'missing'] as const).map((state) => ({
        uuid: v4(),
        duration: 30000,
        type: 'movie' as const,
        sourceType: 'local' as const,
        externalKey: state,
        externalSourceId: tag<MediaSourceName>(faker.string.alphanumeric(16)),
        canonicalId: faker.string.alphanumeric(16),
        title: faker.word.words(3),
        libraryId,
        state,
      })),
    );

    const info = await repo.getProgramInfoForMediaSourceLibrary(
      libraryId,
      'movie',
    );

    expect(info['ok']?.state).toBe('ok');
    expect(info['missing']?.state).toBe('missing');
  });
});
