import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { inArray } from 'drizzle-orm';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { setGlobalOptions } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { DBAccess } from '../DBAccess.ts';
import type { MediaSourceId, ProgramState } from '../schema/base.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { MediaSource } from '../schema/MediaSource.ts';
import { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import { Program } from '../schema/Program.ts';
import type { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import { ProgramGrouping } from '../schema/ProgramGrouping.ts';
import { ProgramStateRepository } from './ProgramStateRepository.ts';

type Fixture = {
  db: string;
  drizzle: DrizzleDBAccess;
  repo: ProgramStateRepository;
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
    await drizzle.delete(ProgramGrouping);
    await use(drizzle);
  },
  repo: async ({ drizzle }, use) => {
    await use(new ProgramStateRepository(drizzle));
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
    mediaType: 'shows',
    externalKey: faker.string.alphanumeric(10),
    enabled: true,
  });
  return libraryId;
}

async function insertGrouping(
  drizzle: DrizzleDBAccess,
  libraryId: string,
  type: ProgramGroupingType,
  state: ProgramState,
  parent?: { showUuid?: string; artistUuid?: string },
): Promise<string> {
  const uuid = v4();
  await drizzle.insert(ProgramGrouping).values({
    uuid,
    title: faker.word.words(2),
    type,
    state,
    libraryId,
    ...parent,
  });
  return uuid;
}

async function insertProgram(
  drizzle: DrizzleDBAccess,
  state: ProgramState,
  parents: {
    seasonUuid?: string;
    tvShowUuid?: string;
    albumUuid?: string;
    artistUuid?: string;
  },
): Promise<void> {
  await drizzle.insert(Program).values({
    uuid: v4(),
    duration: 30000,
    type: parents.albumUuid ? 'track' : 'episode',
    sourceType: 'local',
    externalKey: faker.string.alphanumeric(16),
    externalSourceId: faker.string.alphanumeric(16),
    title: faker.word.words(3),
    state,
    ...parents,
  });
}

async function statesOf(
  drizzle: DrizzleDBAccess,
  ids: string[],
): Promise<Record<string, ProgramState>> {
  const rows = await drizzle
    .select({ uuid: ProgramGrouping.uuid, state: ProgramGrouping.state })
    .from(ProgramGrouping)
    .where(inArray(ProgramGrouping.uuid, ids));
  return Object.fromEntries(rows.map(({ uuid, state }) => [uuid, state]));
}

describe('ProgramStateRepository.syncGroupingStatesForLibrary', () => {
  test('trashes a season whose episodes are all trashed and keeps its show', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const show = await insertGrouping(drizzle, libraryId, 'show', 'ok');
    const emptied = await insertGrouping(drizzle, libraryId, 'season', 'ok', {
      showUuid: show,
    });
    const live = await insertGrouping(drizzle, libraryId, 'season', 'ok', {
      showUuid: show,
    });
    await insertProgram(drizzle, 'missing', {
      seasonUuid: emptied,
      tvShowUuid: show,
    });
    await insertProgram(drizzle, 'ok', { seasonUuid: live, tvShowUuid: show });

    const result = await repo.syncGroupingStatesForLibrary(libraryId, [
      'season',
      'show',
    ]);

    expect(result).toEqual({ missingIds: [emptied], restoredIds: [] });
    expect(await statesOf(drizzle, [show, emptied, live])).toEqual({
      [show]: 'ok',
      [emptied]: 'missing',
      [live]: 'ok',
    });
  });

  test('trashes a show once every episode under it is trashed', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const show = await insertGrouping(drizzle, libraryId, 'show', 'ok');
    const season = await insertGrouping(drizzle, libraryId, 'season', 'ok', {
      showUuid: show,
    });
    await insertProgram(drizzle, 'missing', {
      seasonUuid: season,
      tvShowUuid: show,
    });

    const result = await repo.syncGroupingStatesForLibrary(libraryId, [
      'season',
      'show',
    ]);

    expect(result.missingIds.sort()).toEqual([show, season].sort());
    expect(await statesOf(drizzle, [show, season])).toEqual({
      [show]: 'missing',
      [season]: 'missing',
    });
  });

  test('restores a trashed season and show when an episode comes back', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const show = await insertGrouping(drizzle, libraryId, 'show', 'missing');
    const season = await insertGrouping(
      drizzle,
      libraryId,
      'season',
      'missing',
      { showUuid: show },
    );
    await insertProgram(drizzle, 'ok', {
      seasonUuid: season,
      tvShowUuid: show,
    });

    const result = await repo.syncGroupingStatesForLibrary(libraryId, [
      'season',
      'show',
    ]);

    expect(result.missingIds).toEqual([]);
    expect(result.restoredIds.sort()).toEqual([show, season].sort());
    expect(await statesOf(drizzle, [show, season])).toEqual({
      [show]: 'ok',
      [season]: 'ok',
    });
  });

  test('trashes an album and artist whose tracks are all trashed', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const artist = await insertGrouping(drizzle, libraryId, 'artist', 'ok');
    const emptied = await insertGrouping(drizzle, libraryId, 'album', 'ok', {
      artistUuid: artist,
    });
    const live = await insertGrouping(drizzle, libraryId, 'album', 'ok', {
      artistUuid: artist,
    });
    await insertProgram(drizzle, 'missing', {
      albumUuid: emptied,
      artistUuid: artist,
    });
    await insertProgram(drizzle, 'ok', { albumUuid: live, artistUuid: artist });

    const result = await repo.syncGroupingStatesForLibrary(libraryId, [
      'album',
      'artist',
    ]);

    expect(result).toEqual({ missingIds: [emptied], restoredIds: [] });
    expect(await statesOf(drizzle, [artist, emptied, live])).toEqual({
      [artist]: 'ok',
      [emptied]: 'missing',
      [live]: 'ok',
    });
  });

  test('leaves other libraries and other grouping types alone', async ({
    drizzle,
    repo,
  }) => {
    const libraryId = await createLibrary(drizzle);
    const otherLibraryId = await createLibrary(drizzle);
    const otherSeason = await insertGrouping(
      drizzle,
      otherLibraryId,
      'season',
      'ok',
    );
    const album = await insertGrouping(drizzle, libraryId, 'album', 'ok');

    const result = await repo.syncGroupingStatesForLibrary(libraryId, [
      'season',
      'show',
    ]);

    expect(result).toEqual({ missingIds: [], restoredIds: [] });
    expect(await statesOf(drizzle, [otherSeason, album])).toEqual({
      [otherSeason]: 'ok',
      [album]: 'ok',
    });
  });
});
