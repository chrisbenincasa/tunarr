import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { asc, eq } from 'drizzle-orm';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect, vi } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { CustomShowDB } from '../../db/CustomShowDB.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import { LineupSchema } from '../../db/derived_types/Lineup.ts';
import { BasicProgramRepository } from '../../db/program/BasicProgramRepository.ts';
import { Channel } from '../../db/schema/Channel.ts';
import { ChannelPrograms } from '../../db/schema/ChannelPrograms.ts';
import { CustomShow } from '../../db/schema/CustomShow.ts';
import { CustomShowContent } from '../../db/schema/CustomShowContent.ts';
import { FillerShow } from '../../db/schema/FillerShow.ts';
import { FillerShowContent } from '../../db/schema/FillerShowContent.ts';
import type { MediaSourceName } from '../../db/schema/base.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { Program } from '../../db/schema/Program.ts';
import { setGlobalOptionsUnchecked } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import type { JsonObject } from '../../types/schemas.ts';
import { isJsonObject } from '../../types/schemas.ts';
import { MovieSlotToCustomShowMigration } from './MovieSlotToCustomShowMigration.ts';

vi.mock('@/services/Scheduler.js', () => ({
  GlobalScheduler: { scheduleOneOffTask: vi.fn(), removeTask: vi.fn() },
}));

type Fixture = {
  drizzle: DrizzleDBAccess;
  migration: MovieSlotToCustomShowMigration;
  channelId: string;
};

const ChannelName = 'Cinema';

const test = baseTest.extend<Fixture>({
  drizzle: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    const drizzle = DBAccess.instance.drizzle;
    if (!drizzle) {
      throw new Error('Drizzle is not initialized');
    }
    await use(drizzle);
    await DBAccess.instance.closeConnection(`${dbResult.path}/db.db`);
    await dbResult.cleanup();
  },
  migration: async ({ drizzle }, use) => {
    const kysely = DBAccess.instance.db;
    if (!kysely) {
      throw new Error('Kysely is not initialized');
    }
    const customShowDB = new CustomShowDB(
      kysely,
      drizzle,
      new BasicProgramRepository(kysely, drizzle),
    );
    await use(new MovieSlotToCustomShowMigration(drizzle, customShowDB));
  },
  channelId: async ({ drizzle }, use) => {
    const uuid = v4();
    await drizzle.insert(Channel).values({
      uuid,
      duration: 0,
      guideMinimumDuration: 30_000,
      icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
      name: ChannelName,
      number: 1,
      offline: { mode: 'pic' },
      startTime: 0,
      transcodeConfigId: v4(),
    });
    await use(uuid);
  },
});

type ProgramSpec = {
  title: string;
  airDate: string;
  type?: 'movie' | 'episode' | 'music_video' | 'other_video';
  onChannel?: boolean;
};

async function insertPrograms(
  drizzle: DrizzleDBAccess,
  channelId: string,
  specs: ProgramSpec[],
) {
  const ids = new Map<string, string>();
  for (const spec of specs) {
    const uuid = v4();
    await drizzle.insert(Program).values({
      uuid,
      duration: 90 * 60 * 1000,
      type: spec.type ?? 'movie',
      sourceType: 'plex',
      externalKey: faker.string.alphanumeric({ length: 16 }),
      externalSourceId: tag<MediaSourceName>(
        faker.string.alphanumeric({ length: 16 }),
      ),
      title: spec.title,
      originalAirDate: spec.airDate,
    });
    if (spec.onChannel ?? true) {
      await drizzle.insert(ChannelPrograms).values({
        channelUuid: channelId,
        programUuid: uuid,
      });
    }
    ids.set(spec.title, uuid);
  }
  return (title: string) => {
    const id = ids.get(title);
    if (!id) {
      throw new Error(`No program titled ${title}`);
    }
    return id;
  };
}

async function insertFillerList(
  drizzle: DrizzleDBAccess,
  programIds: string[],
) {
  const uuid = v4();
  const now = +dayjs();
  await drizzle
    .insert(FillerShow)
    .values({ uuid, name: 'Commercials', createdAt: now, updatedAt: now });
  if (programIds.length === 0) {
    return uuid;
  }
  await drizzle.insert(FillerShowContent).values(
    programIds.map((programUuid, index) => ({
      fillerShowUuid: uuid,
      programUuid,
      index,
    })),
  );
  return uuid;
}

async function showContents(drizzle: DrizzleDBAccess, customShowId: string) {
  const rows = await drizzle
    .select({ id: CustomShowContent.contentUuid })
    .from(CustomShowContent)
    .where(eq(CustomShowContent.customShowUuid, customShowId))
    .orderBy(asc(CustomShowContent.index));
  return rows.map(({ id }) => id);
}

async function showsByName(drizzle: DrizzleDBAccess) {
  const rows = await drizzle.select().from(CustomShow);
  return Object.fromEntries(rows.map((row) => [row.name, row.uuid]));
}

function timeSlot(fields: JsonObject): JsonObject {
  return {
    id: v4(),
    startTime: 0,
    ...fields,
  };
}

function timeLineup(slots: JsonObject[], items: JsonObject[] = []): JsonObject {
  return {
    version: 6,
    lastUpdated: 0,
    items,
    startTimeOffsets: items.map((_, index) => index),
    schedule: {
      type: 'time',
      flexPreference: 'end',
      latenessMs: 0,
      maxDays: 7,
      overflow: { type: 'duration', maxMs: 0 },
      padMs: 1,
      period: 'day',
      slots,
      timeZoneOffset: 0,
    },
  };
}

function slotsOf(lineup: JsonObject): JsonObject[] {
  const schedule = lineup['schedule'];
  if (!isJsonObject(schedule) || !Array.isArray(schedule['slots'])) {
    throw new Error('lineup has no slots');
  }
  return schedule['slots'].filter(isJsonObject);
}

function slotAt(lineup: JsonObject, index: number): JsonObject {
  const slot = slotsOf(lineup)[index];
  if (!slot) {
    throw new Error(`no slot at index ${index}`);
  }
  return slot;
}

function customShowIdOf(slot: JsonObject): string {
  const id = slot['customShowId'];
  if (typeof id !== 'string') {
    throw new Error('slot has no customShowId');
  }
  return id;
}

const Movies: ProgramSpec[] = [
  { title: 'Bravo', airDate: '2001-01-01' },
  { title: 'Alpha', airDate: '2003-01-01' },
  { title: 'Charlie', airDate: '2002-01-01' },
];

describe('MovieSlotToCustomShowMigration', () => {
  test('builds one show sorted by air date for a next slot', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    const ids = await insertPrograms(drizzle, channelId, Movies);
    const lineup = timeLineup([
      timeSlot({ type: 'movie', order: 'next', direction: 'asc' }),
    ]);

    await migration.migrate(lineup, { channelId });

    const slot = slotAt(lineup, 0);
    expect(slot).toMatchObject({
      type: 'custom-show',
      order: 'next',
      direction: 'asc',
    });
    expect(await showsByName(drizzle)).toEqual({
      [`${ChannelName} Movies`]: customShowIdOf(slot),
    });
    expect(await showContents(drizzle, customShowIdOf(slot))).toEqual([
      ids('Bravo'),
      ids('Charlie'),
      ids('Alpha'),
    ]);
  });

  test.for([
    ['next', 'desc', 'next', ['Alpha', 'Charlie', 'Bravo']],
    ['chronological', 'asc', 'next', ['Bravo', 'Charlie', 'Alpha']],
    ['alphanumeric', 'asc', 'next', ['Alpha', 'Bravo', 'Charlie']],
    ['alphanumeric', 'desc', 'next', ['Charlie', 'Bravo', 'Alpha']],
    [
      'ordered_shuffle',
      'desc',
      'ordered_shuffle',
      ['Alpha', 'Charlie', 'Bravo'],
    ],
    ['shuffle', 'desc', 'shuffle', ['Bravo', 'Charlie', 'Alpha']],
  ] as const)(
    '%s %s becomes a %s slot over a show in the right order',
    async (
      [order, direction, expectedOrder, expectedTitles],
      { drizzle, migration, channelId },
    ) => {
      const ids = await insertPrograms(drizzle, channelId, Movies);
      const lineup = timeLineup([
        timeSlot({ type: 'movie', order, direction }),
      ]);

      await migration.migrate(lineup, { channelId });

      const slot = slotAt(lineup, 0);
      expect(slot).toMatchObject({
        type: 'custom-show',
        order: expectedOrder,
        direction: 'asc',
      });
      expect(await showContents(drizzle, customShowIdOf(slot))).toEqual(
        expectedTitles.map(ids),
      );
    },
  );

  test('builds one show per distinct sort and shares it between slots', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const lineup = timeLineup([
      timeSlot({ type: 'movie', order: 'next', direction: 'asc' }),
      timeSlot({ type: 'movie', order: 'alphanumeric', direction: 'asc' }),
      timeSlot({ type: 'movie', order: 'chronological', direction: 'asc' }),
      timeSlot({ type: 'movie', order: 'shuffle' }),
    ]);

    await migration.migrate(lineup, { channelId });

    const shows = await showsByName(drizzle);
    const byDate = shows[`${ChannelName} Movies (Oldest First)`];
    const byTitle = shows[`${ChannelName} Movies (A-Z)`];
    expect(Object.keys(shows)).toHaveLength(2);
    expect(slotsOf(lineup).map(customShowIdOf)).toEqual([
      byDate,
      byTitle,
      byDate,
      byDate,
    ]);
  });

  test('keeps every other slot field', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const fillerListId = await insertFillerList(drizzle, []);
    const slotFields: JsonObject = {
      id: v4(),
      startTime: 3_600_000,
      padMs: 5,
      latenessMs: 10,
      iterationGroup: v4(),
      linkMode: 'continue',
      filler: [{ types: ['pre', 'mid'], fillerListId, fillerOrder: 'shuffle' }],
      midRoll: {
        rule: { type: 'fixed_interval', intervalMs: 600_000 },
        breakDurationMs: 60_000,
      },
    };
    const lineup = timeLineup([
      { ...slotFields, type: 'movie', order: 'next', direction: 'asc' },
    ]);

    await migration.migrate(lineup, { channelId });

    expect(slotAt(lineup, 0)).toEqual({
      ...slotFields,
      type: 'custom-show',
      customShowId: customShowIdOf(slotAt(lineup, 0)),
      order: 'next',
      direction: 'asc',
    });
  });

  test('keeps random slot weight, cooldown, and duration spec', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const slotFields: JsonObject = {
      id: v4(),
      weight: 30,
      cooldownMs: 120_000,
      durationSpec: { type: 'dynamic', programCount: 2 },
    };
    const lineup: JsonObject = {
      version: 6,
      lastUpdated: 0,
      items: [],
      startTimeOffsets: [],
      schedule: {
        type: 'random',
        flexPreference: 'end',
        maxDays: 7,
        padMs: 1,
        padStyle: 'slot',
        randomDistribution: 'weighted',
        slots: [
          { ...slotFields, type: 'movie', order: 'shuffle', direction: 'asc' },
        ],
      },
    };

    await migration.migrate(lineup, { channelId });

    expect(slotAt(lineup, 0)).toMatchObject({
      ...slotFields,
      type: 'custom-show',
      order: 'shuffle',
    });
    const parsed = LineupSchema.parse({ ...lineup, version: 7 });
    expect(parsed.schedule?.slots[0]?.type).toBe('custom-show');
  });

  test('leaves out filler-list members, lineup-only filler, and non-movies', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    const ids = await insertPrograms(drizzle, channelId, [
      { title: 'Movie', airDate: '2001-01-01' },
      { title: 'Music Video', airDate: '2002-01-01', type: 'music_video' },
      { title: 'Episode', airDate: '2003-01-01', type: 'episode' },
      { title: 'Commercial', airDate: '2004-01-01', type: 'other_video' },
      { title: 'Slot Filler', airDate: '2005-01-01', type: 'other_video' },
      { title: 'Lineup Filler', airDate: '2006-01-01', type: 'other_video' },
      { title: 'Both', airDate: '2007-01-01' },
      { title: 'Off Channel', airDate: '2008-01-01', onChannel: false },
    ]);
    const slotFillerList = await insertFillerList(drizzle, [
      ids('Slot Filler'),
    ]);
    const fillerSlotList = await insertFillerList(drizzle, [ids('Commercial')]);
    const lineup = timeLineup(
      [
        timeSlot({
          type: 'movie',
          order: 'next',
          direction: 'asc',
          filler: [{ types: ['pre'], fillerListId: slotFillerList }],
        }),
        timeSlot({
          type: 'filler',
          fillerListId: fillerSlotList,
          order: 'shuffle_prefer_short',
          durationWeighting: 'linear',
          decayFactor: 0.5,
          recoveryFactor: 0.05,
        }),
      ],
      [
        {
          type: 'content',
          id: ids('Lineup Filler'),
          durationMs: 1,
          fillerType: 'pre',
        },
        { type: 'content', id: ids('Both'), durationMs: 1, fillerListId: v4() },
        { type: 'content', id: ids('Both'), durationMs: 1 },
      ],
    );

    await migration.migrate(lineup, { channelId });

    expect(
      await showContents(drizzle, customShowIdOf(slotAt(lineup, 0))),
    ).toEqual([ids('Movie'), ids('Music Video'), ids('Both')]);
  });

  test('turns movie slots into flex when there are no movies', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, [
      { title: 'Episode', airDate: '2001-01-01', type: 'episode' },
    ]);
    const slotId = v4();
    const lineup = timeLineup([
      {
        id: slotId,
        startTime: 0,
        type: 'movie',
        order: 'next',
        direction: 'asc',
        filler: [],
      },
    ]);

    await migration.migrate(lineup, { channelId });

    expect(slotAt(lineup, 0)).toEqual({
      id: slotId,
      startTime: 0,
      type: 'flex',
    });
    expect(await showsByName(drizzle)).toEqual({});
    expect(LineupSchema.safeParse({ ...lineup, version: 7 }).success).toBe(
      true,
    );
  });

  test('leaves a schedule without movie slots untouched', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const lineup = timeLineup([
      timeSlot({ type: 'show', showId: v4(), order: 'next', direction: 'asc' }),
    ]);
    const before = structuredClone(lineup);

    await migration.migrate(lineup, { channelId });

    expect(lineup).toEqual(before);
    expect(await showsByName(drizzle)).toEqual({});
  });

  test('leaves a channel without a schedule untouched', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const lineup: JsonObject = {
      version: 6,
      lastUpdated: 0,
      items: [],
      startTimeOffsets: [],
    };
    const before = structuredClone(lineup);

    await migration.migrate(lineup, { channelId });

    expect(lineup).toEqual(before);
    expect(await showsByName(drizzle)).toEqual({});
  });

  test('produces a lineup that parses under the current schema', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const lineup = timeLineup([
      timeSlot({ type: 'movie', order: 'alphanumeric', direction: 'desc' }),
    ]);

    await migration.migrate(lineup, { channelId });

    const parsed = LineupSchema.parse({ ...lineup, version: 7 });
    expect(parsed.schedule?.slots[0]).toMatchObject({
      type: 'custom-show',
      customShowId: customShowIdOf(slotAt(lineup, 0)),
      order: 'next',
    });
  });

  test('reuses the show when it runs again', async ({
    drizzle,
    migration,
    channelId,
  }) => {
    await insertPrograms(drizzle, channelId, Movies);
    const original = timeLineup([
      timeSlot({ type: 'movie', order: 'next', direction: 'asc' }),
    ]);
    const first = structuredClone(original);
    const second = structuredClone(original);

    await migration.migrate(first, { channelId });
    await migration.migrate(second, { channelId });

    expect(Object.keys(await showsByName(drizzle))).toHaveLength(1);
    expect(customShowIdOf(slotAt(second, 0))).toBe(
      customShowIdOf(slotAt(first, 0)),
    );
  });

  test('fails without a channel ID when there are movie slots', async ({
    migration,
  }) => {
    const lineup = timeLineup([
      timeSlot({ type: 'movie', order: 'next', direction: 'asc' }),
    ]);

    await expect(migration.migrate(lineup)).rejects.toThrow(/channel ID/);
  });
});
