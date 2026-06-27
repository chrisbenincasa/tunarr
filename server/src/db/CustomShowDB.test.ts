import { faker } from '@faker-js/faker';
import type { ContentProgram } from '@tunarr/types';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect, vi } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { setGlobalOptionsUnchecked } from '../globals.ts';
import { copyPreMigratedDb } from '../testing/testDbFactory.ts';
import { CustomShowDB } from './CustomShowDB.ts';
import { DBAccess } from './DBAccess.ts';
import { BasicProgramRepository } from './program/BasicProgramRepository.ts';
import type { MediaSourceId, MediaSourceName } from './schema/base.ts';
import { CustomShow } from './schema/CustomShow.ts';
import type { NewCustomShowContent } from './schema/CustomShowContent.ts';
import { CustomShowContent } from './schema/CustomShowContent.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import { MediaSource } from './schema/MediaSource.ts';
import type { NewProgramDao } from './schema/Program.ts';
import { Program } from './schema/Program.ts';

// Suppress background task scheduling that fires in setImmediate after upsertContentPrograms.
// These callbacks try to resolve Inversify bindings that aren't set up in tests.
vi.mock('@/services/Scheduler.js', () => ({
  GlobalScheduler: { scheduleOneOffTask: vi.fn(), removeTask: vi.fn() },
}));
vi.mock('@/tasks/TaskQueue.js', () => ({
  PlexTaskQueue: {
    pause: vi.fn(),
    resume: vi.fn(),
    add: vi.fn().mockResolvedValue(undefined),
  },
  JellyfinTaskQueue: {
    pause: vi.fn(),
    resume: vi.fn(),
    add: vi.fn().mockResolvedValue(undefined),
  },
}));

type Fixture = {
  db: string;
  mediaSourceId: MediaSourceId;
  customShowDb: CustomShowDB;
  drizzle: DrizzleDBAccess;
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
    const dbPath = `${dbResult.path}/db.db`;
    await DBAccess.instance.closeConnection(dbPath);
    await dbResult.cleanup();
  },
  mediaSourceId: async ({ db: _ }, use) => {
    const drizzle = DBAccess.instance.drizzle!;
    const uuid = v4() as MediaSourceId;
    const now = +dayjs();
    await drizzle.insert(MediaSource).values({
      uuid,
      name: tag<MediaSourceName>('Test Plex Server'),
      accessToken: 'test-token',
      index: 0,
      type: 'plex',
      uri: 'http://localhost:32400',
      createdAt: now,
      updatedAt: now,
    });
    await use(uuid);
  },
  customShowDb: async ({ db: _ }, use) => {
    const dbAccess = DBAccess.instance;

    const kyselyDb = dbAccess.db!;
    const drizzleDb = dbAccess.drizzle!;
    const basicProgramRepo = new BasicProgramRepository(kyselyDb, drizzleDb);
    const customShowDb = new CustomShowDB(
      kyselyDb,
      drizzleDb,
      basicProgramRepo,
    );

    await use(customShowDb);
  },
  drizzle: async ({ db: _ }, use) => {
    await use(DBAccess.instance.drizzle!);
  },
});

function createProgram(
  mediaSourceId: MediaSourceId,
  overrides?: Partial<NewProgramDao>,
): NewProgramDao {
  const now = +dayjs();
  return {
    uuid: v4(),
    canonicalId: v4(),
    createdAt: now,
    updatedAt: now,
    albumName: null,
    albumUuid: null,
    artistName: null,
    artistUuid: null,
    duration: faker.number.int({ min: 60000, max: 7200000 }),
    episode: null,
    episodeIcon: null,
    externalKey: faker.string.alphanumeric(10),
    externalSourceId: tag<MediaSourceName>(faker.string.alphanumeric(8)),
    mediaSourceId,
    libraryId: null,
    localMediaFolderId: null,
    localMediaSourcePathId: null,
    filePath: null,
    grandparentExternalKey: null,
    icon: null,
    originalAirDate: null,
    parentExternalKey: null,
    plexFilePath: null,
    plexRatingKey: null,
    rating: null,
    seasonIcon: null,
    seasonNumber: null,
    seasonUuid: null,
    showIcon: null,
    showTitle: null,
    sourceType: 'plex',
    summary: null,
    plot: null,
    tagline: null,
    title: faker.word.words(3),
    tvShowUuid: null,
    type: 'movie',
    year: faker.date.past().getFullYear(),
    state: 'ok',
    ...overrides,
  };
}

async function insertProgram(drizzle: DrizzleDBAccess, program: NewProgramDao) {
  await drizzle.insert(Program).values(program);
  return program;
}

function makePersistedContentProgram(program: NewProgramDao): ContentProgram {
  return {
    type: 'content',
    id: program.uuid,
    uniqueId: program.uuid,
    duration: program.duration,
    program: {
      type: 'movie',
      sourceType: program.sourceType,
      mediaSourceId: program.mediaSourceId,
      externalId: program.externalKey,
      canonicalId: program.canonicalId,
      libraryId: program.libraryId ?? '',
      title: program.title ?? '',
    } as ContentProgram['program'],
  };
}

async function createCustomShow(
  drizzle: DrizzleDBAccess,
  name?: string,
): Promise<typeof CustomShow.$inferSelect> {
  const now = +dayjs();
  const show = {
    uuid: v4(),
    createdAt: now,
    updatedAt: now,
    name: name ?? faker.word.words(2),
  };
  await drizzle.insert(CustomShow).values(show);
  return show;
}

async function insertCustomShowContent(
  drizzle: DrizzleDBAccess,
  rows: NewCustomShowContent[],
) {
  if (rows.length > 0) {
    await drizzle.insert(CustomShowContent).values(rows);
  }
}

describe('CustomShowDB', () => {
  describe('duplicate programs in custom shows', () => {
    test('should allow the same program to appear multiple times with different indexes', async ({
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle);

      const rows: NewCustomShowContent[] = [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 2 },
      ];

      // This should NOT throw — the new composite PK includes index
      await expect(
        insertCustomShowContent(drizzle, rows),
      ).resolves.not.toThrow();

      const content = await drizzle.query.customShowContent.findMany({
        where: (fields, { eq }) => eq(fields.customShowUuid, show.uuid),
        orderBy: (fields, { asc }) => asc(fields.index),
      });

      expect(content).toHaveLength(3);
      expect(content.map((c) => c.index)).toEqual([0, 1, 2]);
      expect(content.every((c) => c.contentUuid === program.uuid)).toBe(true);
    });

    test('should still enforce uniqueness on (contentUuid, customShowUuid, index) triple', async ({
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
      ]);

      // Inserting the same (show, program, index) should fail
      await expect(
        insertCustomShowContent(drizzle, [
          { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        ]),
      ).rejects.toThrow();
    });

    test('should allow different programs at the same index in different custom shows', async ({
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show1 = await createCustomShow(drizzle, 'Show 1');
      const show2 = await createCustomShow(drizzle, 'Show 2');

      await expect(
        insertCustomShowContent(drizzle, [
          { customShowUuid: show1.uuid, contentUuid: program.uuid, index: 0 },
          { customShowUuid: show2.uuid, contentUuid: program.uuid, index: 0 },
        ]),
      ).resolves.not.toThrow();
    });
  });

  describe('getShowPrograms', () => {
    test('should return programs in index order', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const programA = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Program A' }),
      );
      const programB = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Program B' }),
      );
      const programC = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Program C' }),
      );

      const show = await createCustomShow(drizzle);

      // Insert in non-sequential order to verify sorting
      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: programC.uuid, index: 2 },
        { customShowUuid: show.uuid, contentUuid: programA.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: programB.uuid, index: 1 },
      ]);

      const programs = await customShowDb.getShowPrograms(show.uuid);

      expect(programs).toHaveLength(3);
      expect(programs[0]!.title).toBe('Program A');
      expect(programs[1]!.title).toBe('Program B');
      expect(programs[2]!.title).toBe('Program C');
    });

    test('should return duplicate programs preserving order', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const programA = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Repeat Me' }),
      );
      const programB = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Other' }),
      );

      const show = await createCustomShow(drizzle);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: programA.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: programB.uuid, index: 1 },
        { customShowUuid: show.uuid, contentUuid: programA.uuid, index: 2 },
      ]);

      const programs = await customShowDb.getShowPrograms(show.uuid);

      expect(programs).toHaveLength(3);
      expect(programs[0]!.title).toBe('Repeat Me');
      expect(programs[1]!.title).toBe('Other');
      expect(programs[2]!.title).toBe('Repeat Me');
    });

    test('should return empty array for nonexistent show', async ({
      customShowDb,
    }) => {
      const programs = await customShowDb.getShowPrograms(v4());
      expect(programs).toHaveLength(0);
    });
  });

  describe('getShow', () => {
    test('should return show with program data', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
      ]);

      const result = await customShowDb.getShow(show.uuid);

      expect(result).toBeDefined();
      expect(result!.uuid).toBe(show.uuid);
      expect(result!.name).toBe(show.name);
    });

    test('should return undefined for nonexistent show', async ({
      customShowDb,
    }) => {
      const result = await customShowDb.getShow(v4());
      expect(result).toBeUndefined();
    });
  });

  describe('deleteShow', () => {
    test('should delete a show and its content', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
      ]);

      const deleted = await customShowDb.deleteShow(show.uuid);
      expect(deleted).toBe(true);

      // Verify show is gone
      const result = await customShowDb.getShow(show.uuid);
      expect(result).toBeUndefined();

      // Verify content is gone
      const content = await drizzle.query.customShowContent.findMany({
        where: (fields, { eq }) => eq(fields.customShowUuid, show.uuid),
      });
      expect(content).toHaveLength(0);
    });

    test('should return false for nonexistent show', async ({
      customShowDb,
    }) => {
      const deleted = await customShowDb.deleteShow(v4());
      expect(deleted).toBe(false);
    });
  });

  describe('getAllShowsInfo', () => {
    test('should return correct content count with duplicate programs', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle, 'Duplicates Show');

      // Same program at 3 different indexes
      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 2 },
      ]);

      const shows = await customShowDb.getAllShowsInfo();
      const found = shows.find((s) => s.id === show.uuid);

      expect(found).toBeDefined();
      // With the .distinct() removed, count now correctly reflects total entries
      expect(found!.count).toBe(3);
    });

    test('should return multiple shows with correct counts', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const programA = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const programB = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );

      const show1 = await createCustomShow(drizzle, 'Show One');
      const show2 = await createCustomShow(drizzle, 'Show Two');

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show1.uuid, contentUuid: programA.uuid, index: 0 },
        { customShowUuid: show1.uuid, contentUuid: programB.uuid, index: 1 },
      ]);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show2.uuid, contentUuid: programA.uuid, index: 0 },
      ]);

      const shows = await customShowDb.getAllShowsInfo();
      const found1 = shows.find((s) => s.id === show1.uuid);
      const found2 = shows.find((s) => s.id === show2.uuid);

      expect(found1).toBeDefined();
      expect(found1!.count).toBe(2);

      expect(found2).toBeDefined();
      expect(found2!.count).toBe(1);
    });

    test('should calculate total duration across duplicate entries', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const duration = 120000; // 2 minutes
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { duration }),
      );
      const show = await createCustomShow(drizzle, 'Duration Test');

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 2 },
      ]);

      const shows = await customShowDb.getAllShowsInfo();
      const found = shows.find((s) => s.id === show.uuid);

      expect(found).toBeDefined();
      // totalDuration uses a correlated subquery per row, so with 3 content
      // rows pointing to the same program, we get 3 * duration
      expect(found!.totalDuration).toBe(duration * 3);
    });
  });

  describe('getShows', () => {
    test('should return shows with correct content counts via Drizzle path', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle, 'Drizzle Show');

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
      ]);

      const shows = await customShowDb.getShows([show.uuid]);

      expect(shows).toHaveLength(1);
      // The Drizzle path uses result.content.length, which correctly counts all entries
      expect(shows[0]!.contentCount).toBe(2);
    });

    test('should return empty array for empty input', async ({
      customShowDb,
    }) => {
      const shows = await customShowDb.getShows([]);
      expect(shows).toHaveLength(0);
    });
  });

  describe('cascade deletes', () => {
    test('should delete custom show content when a program is deleted', async ({
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 1 },
      ]);

      // Delete the program — content should cascade
      await drizzle.delete(Program).where(
        // Using drizzle eq
        (await import('drizzle-orm')).eq(Program.uuid, program.uuid),
      );

      const content = await drizzle.query.customShowContent.findMany({
        where: (fields, { eq }) => eq(fields.customShowUuid, show.uuid),
      });

      expect(content).toHaveLength(0);
    });

    test('should delete custom show content when a custom show is deleted', async ({
      drizzle,
      mediaSourceId,
    }) => {
      const program = await insertProgram(
        drizzle,
        createProgram(mediaSourceId),
      );
      const show = await createCustomShow(drizzle);

      await insertCustomShowContent(drizzle, [
        { customShowUuid: show.uuid, contentUuid: program.uuid, index: 0 },
      ]);

      const { eq } = await import('drizzle-orm');
      await drizzle.delete(CustomShow).where(eq(CustomShow.uuid, show.uuid));

      const content = await drizzle.query.customShowContent.findMany({
        where: (fields, ops) => ops.eq(fields.customShowUuid, show.uuid),
      });

      expect(content).toHaveLength(0);
    });
  });

  describe('upsertCustomShowContent (via createShow)', () => {
    test('should save persisted programs to a new custom show', async ({
      customShowDb,
      drizzle,
      mediaSourceId,
    }) => {
      const program1 = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Persisted 1' }),
      );
      const program2 = await insertProgram(
        drizzle,
        createProgram(mediaSourceId, { title: 'Persisted 2' }),
      );

      const showId = await customShowDb.createShow({
        name: 'Persisted Only Show',
        programs: [
          makePersistedContentProgram(program1),
          makePersistedContentProgram(program2),
        ],
      });

      const content = await drizzle.query.customShowContent.findMany({
        where: (fields, { eq }) => eq(fields.customShowUuid, showId),
        orderBy: (fields, { asc }) => asc(fields.index),
      });

      expect(content).toHaveLength(2);
      expect(content[0]!.contentUuid).toBe(program1.uuid);
      expect(content[1]!.contentUuid).toBe(program2.uuid);
    });
  });
});
