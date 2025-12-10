import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { sql, SQL } from 'drizzle-orm';
import { SelectResultFields } from 'drizzle-orm/query-builders/select.types';
import { SelectedFields } from 'drizzle-orm/sqlite-core';
import tmp from 'tmp-promise';
import { StrictOmit } from 'ts-essentials';
import { v4 } from 'uuid';
import { test as baseTest } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { setGlobalOptions } from '../globals.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { DBAccess } from './DBAccess.ts';
import { IProgramDB } from './interfaces/IProgramDB.ts';
import { ProgramDB } from './ProgramDB.ts';
import { NewArtwork } from './schema/Artwork.ts';
import {
  MediaSourceId,
  MediaSourceType,
  ProgramExternalIdSourceType,
} from './schema/base.ts';
import {
  NewCreditWithArtwork,
  NewProgramGroupingWithRelations,
  NewProgramWithRelations,
  SpecificProgramGroupingType,
} from './schema/derivedTypes.ts';
import { NewGenre } from './schema/Genre.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import {
  MediaSource,
  MediaSourceOrm,
  NewMediaSourceOrm,
} from './schema/MediaSource.ts';
import {
  MediaSourceLibrary,
  MediaSourceLibraryOrm,
} from './schema/MediaSourceLibrary.ts';
import { NewProgramDao, ProgramType } from './schema/Program.ts';
import {
  NewProgramGroupingOrm,
  ProgramGroupingType,
} from './schema/ProgramGrouping.ts';
import { NewMultiProgramGroupingId } from './schema/ProgramGroupingExternalId.ts';
import { NewStudio } from './schema/Studio.ts';

export function jsonObject<T extends SelectedFields>(shape: T) {
  const chunks: SQL[] = [];

  Object.entries(shape).forEach(([key, value]) => {
    if (chunks.length > 0) {
      chunks.push(sql.raw(`,`));
    }

    chunks.push(sql.raw(`'${key}',`));

    chunks.push(sql`${value}`);
  });

  return sql<SelectResultFields<T>>`coalesce(json_object(${sql.join(
    chunks,
  )}),  ${sql`json_object()`})`;
}

export function jsonAggObject<T extends SelectedFields>(shape: T) {
  return sql<SelectResultFields<T>[]>`coalesce(json_group_array(${jsonObject(
    shape,
  )}), ${sql`json_array()`})`.mapWith(
    (v) => JSON.parse(v) as SelectResultFields<T>[],
  );
}

type Fixture = {
  db: string;
  programDb: IProgramDB;
  drizzle: DrizzleDBAccess;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    setGlobalOptions({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr();
    await use(dbResult.path);
    await dbResult.cleanup();
  },
  programDb: async ({ db: _ }, use) => {
    const dbAccess = DBAccess.instance;
    const logger = LoggerFactory.child({ className: 'ProgramDB' });

    // Mock the task factories required by ProgramDB
    const mockTaskFactory = () => ({ enqueue: async () => {} }) as any;

    const programDb = new ProgramDB(
      logger,
      mockTaskFactory,
      mockTaskFactory,
      dbAccess.db!,
      () => ({}) as any, // ProgramDaoMinterFactory
      dbAccess.drizzle!,
    );

    await use(programDb);
  },
  drizzle: async ({ db: _ }, use) => {
    const dbAccess = DBAccess.instance;
    await use(dbAccess.drizzle!);
  },
});

// Test helper functions
async function createTestMediaSourceLibrary(
  drizzle: DrizzleDBAccess,
  overrides?: Partial<NewMediaSourceOrm>,
): Promise<MediaSourceLibraryOrm> {
  // First create a media source
  const mediaSource = {
    uuid: v4() as MediaSourceId,
    name: tag(faker.string.alpha()),
    type: 'local' as const,
    createdAt: +dayjs(),
    updatedAt: +dayjs(),
    uri: '',
    accessToken: '',
    clientIdentifier: null,
    index: 0,
    sendChannelUpdates: false,
    sendGuideUpdates: false,
    username: null,
    userId: null,
    mediaType: null,
    ...(overrides ?? {}),
  } satisfies MediaSourceOrm;

  await drizzle.insert(MediaSource).values(mediaSource);

  // Then create a library
  const library = {
    uuid: v4(),
    name: faker.music.genre(),
    mediaSourceId: mediaSource.uuid,
    mediaType: 'movies' as const,
    lastScannedAt: null,
    externalKey: faker.string.alphanumeric(10),
    enabled: true,
  } satisfies typeof MediaSourceLibrary.$inferInsert;

  await drizzle.insert(MediaSourceLibrary).values(library);

  return library;
}

function createBaseProgramGrouping<Typ extends ProgramGroupingType>(
  type: Typ,
  libraryId: string,
  sourceType: MediaSourceType = 'local',
  overrides?: StrictOmit<Partial<NewProgramGroupingOrm>, 'type'>,
): SpecificProgramGroupingType<Typ, NewProgramGroupingOrm> {
  const now = +dayjs();
  return {
    uuid: v4(),
    canonicalId: v4(),
    createdAt: now,
    updatedAt: now,
    icon: null,
    index: null,
    summary: faker.lorem.paragraph(),
    plot: null,
    tagline: null,
    title: faker.music.songName(),
    type,
    year: faker.date.past().getFullYear(),
    releaseDate: null,
    rating: null,
    sourceType,
    externalKey:
      sourceType === 'local'
        ? faker.system.filePath()
        : faker.string.alphanumeric(10),
    mediaSourceId: tag<MediaSourceId>(v4()),
    artistUuid: null,
    showUuid: null,
    libraryId,
    state: 'ok',
    ...overrides,
  } as const;
}

function createBaseProgram(
  type: ProgramType,
  libraryId: string,
  sourceType: MediaSourceType = 'local',
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
    duration: faker.number.int({ min: 60000, max: 7200000 }), // 1 minute to 2 hours in ms
    episode: type === 'episode' ? faker.number.int({ min: 1, max: 24 }) : null,
    episodeIcon: null,
    externalKey:
      sourceType === 'local'
        ? faker.system.filePath()
        : faker.string.alphanumeric(10),
    externalSourceId: tag(faker.string.alphanumeric(8)),
    mediaSourceId: tag<MediaSourceId>(v4()),
    libraryId,
    localMediaFolderId: null,
    localMediaSourcePathId: null,
    filePath: sourceType === 'local' ? faker.system.filePath() : null,
    grandparentExternalKey: null,
    icon: null,
    originalAirDate: null,
    parentExternalKey: null,
    plexFilePath: null,
    plexRatingKey: null,
    rating: null,
    seasonIcon: null,
    seasonNumber:
      type === 'episode' ? faker.number.int({ min: 1, max: 10 }) : null,
    seasonUuid: null,
    showIcon: null,
    showTitle: type === 'episode' ? faker.word.words(3) : null,
    sourceType,
    summary: faker.lorem.paragraph(),
    plot: null,
    tagline: null,
    title:
      type === 'movie'
        ? faker.word.words(3)
        : type === 'track'
          ? faker.music.songName()
          : faker.lorem.words(4),
    tvShowUuid: null,
    type,
    year: faker.date.past().getFullYear(),
    state: 'ok',
    ...overrides,
  };
}

function createGroupingExternalId(
  groupUuid: string,
  sourceType: Exclude<ProgramExternalIdSourceType, 'local'> = 'plex',
  mediaSourceId: string | MediaSourceId = v4(),
  externalKey: string = faker.string.alphanumeric(10),
): NewMultiProgramGroupingId {
  return {
    type: 'multi',
    uuid: v4(),
    groupUuid,
    sourceType,
    externalKey,
    externalSourceId: tag(faker.string.alphanumeric(8)),
    mediaSourceId: tag<MediaSourceId>(mediaSourceId),
    libraryId: null,
    externalFilePath: null,
    createdAt: +dayjs(),
    updatedAt: +dayjs(),
  };
}

function createGenre(): NewGenre {
  return {
    uuid: v4(),
    name: faker.music.genre(),
  };
}

function createStudio(): NewStudio {
  return {
    uuid: v4(),
    name: faker.company.name(),
  };
}

function createArtwork(groupingId: string): NewArtwork {
  return {
    uuid: v4(),
    artworkType: 'poster',
    groupingId,
    programId: null,
    creditId: null,
    sourcePath: faker.internet.url(),
    cachePath: null,
    createdAt: dayjs().toDate(),
    updatedAt: dayjs().toDate(),
  };
}

function createCreditWithArtwork(groupingId: string): NewCreditWithArtwork {
  const creditId = v4();
  return {
    credit: {
      type: 'cast',
      uuid: creditId,
      groupingId,
      programId: null,
      name: faker.person.fullName(),
      role: faker.person.jobTitle(),
      index: faker.number.int({ min: 0, max: 10 }),
      createdAt: dayjs().toDate(),
      updatedAt: dayjs().toDate(),
    },
    artwork: [
      {
        uuid: v4(),
        artworkType: 'thumbnail',
        groupingId: null,
        programId: null,
        creditId: creditId,
        sourcePath: faker.internet.url(),
        cachePath: null,
        createdAt: dayjs().toDate(),
        updatedAt: dayjs().toDate(),
      },
    ],
  };
}

function createProgramGrouping<Typ extends ProgramGroupingType>(
  type: Typ,
  libraryId: string,
  sourceType: MediaSourceType = 'local',
  overrides?: Partial<NewProgramGroupingOrm>,
): NewProgramGroupingWithRelations<Typ> {
  const groupingId = v4();
  const programGrouping = createBaseProgramGrouping(
    type,
    libraryId,
    sourceType,
    { uuid: groupingId, ...overrides },
  );

  return {
    programGrouping: programGrouping,
    externalIds:
      sourceType !== 'local'
        ? [
            createGroupingExternalId(
              programGrouping.uuid,
              sourceType,
              overrides?.mediaSourceId ?? programGrouping.mediaSourceId,
              programGrouping.externalKey,
            ),
          ]
        : [],
    artwork: [createArtwork(groupingId)],
    credits: [createCreditWithArtwork(groupingId)],
    genres: [createGenre()],
    studios: [createStudio()],
  };
}

describe('ProgramDB', () => {
  describe('upsertProgramGrouping', () => {
    describe('local media - insert operations', () => {
      test('should insert a new show (local)', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity).toBeDefined();
        expect(result.entity.type).toBe('show');
        expect(result.entity.title).toBe(showGrouping.programGrouping.title);
        expect(result.entity.sourceType).toBe('local');
      });

      test('should insert a new season (local) with parent show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const showResult = await programDb.upsertProgramGrouping(showGrouping);

        const seasonGrouping = createProgramGrouping(
          'season',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            showUuid: showResult.entity.uuid,
          },
        );

        const result = await programDb.upsertProgramGrouping(seasonGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity).toBeDefined();
        expect(result.entity.type).toBe('season');
        expect(result.entity.showUuid).toBe(showResult.entity.uuid);
        expect(result.entity.title).toBe(seasonGrouping.programGrouping.title);
      });

      test('should insert a new artist (local)', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const artistGrouping = createProgramGrouping(
          'artist',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
          },
        );

        const result = await programDb.upsertProgramGrouping(artistGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity).toBeDefined();
        expect(result.entity.type).toBe('artist');
        expect(result.entity.title).toBe(artistGrouping.programGrouping.title);
      });

      test('should insert a new album (local) with parent artist', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const artistGrouping = createProgramGrouping(
          'artist',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
          },
        );
        const artistResult =
          await programDb.upsertProgramGrouping(artistGrouping);

        const albumGrouping = createProgramGrouping(
          'album',
          library.uuid,

          'local',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
            artistUuid: artistResult.entity.uuid,
          },
        );

        const result = await programDb.upsertProgramGrouping(albumGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity).toBeDefined();
        expect(result.entity.type).toBe('album');
        expect(result.entity.artistUuid).toBe(artistResult.entity.uuid);
        expect(result.entity.title).toBe(albumGrouping.programGrouping.title);
      });
    });

    describe('external media - insert operations', () => {
      test('should insert a new show from Plex', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity).toBeDefined();
        expect(result.entity.type).toBe('show');
        expect(result.entity.sourceType).toBe('plex');
        expect(result.entity.externalIds).toHaveLength(1);
      });

      test('should insert a new show from Jellyfin', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'jellyfin',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity.sourceType).toBe('jellyfin');
      });

      test('should insert a new show from Emby', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'emby',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.wasUpdated).toBe(false);
        expect(result.entity.sourceType).toBe('emby');
      });

      test('should insert a season from Plex with parent show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const showResult = await programDb.upsertProgramGrouping(showGrouping);

        const seasonGrouping = createProgramGrouping(
          'season',
          library.uuid,
          'plex',
          {
            showUuid: showResult.entity.uuid,
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(seasonGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.entity.type).toBe('season');
        expect(result.entity.showUuid).toBe(showResult.entity.uuid);
        expect(result.entity.sourceType).toBe('plex');
      });

      test('should insert an artist from Plex', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const artistGrouping = createProgramGrouping(
          'artist',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(artistGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.entity.type).toBe('artist');
        expect(result.entity.sourceType).toBe('plex');
      });

      test('should insert an album from Jellyfin with parent artist', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const artistGrouping = createProgramGrouping(
          'artist',
          library.uuid,
          'jellyfin',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
          },
        );
        const artistResult =
          await programDb.upsertProgramGrouping(artistGrouping);

        const albumGrouping = createProgramGrouping(
          'album',
          library.uuid,
          'jellyfin',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
            artistUuid: artistResult.entity.uuid,
          },
        );

        const result = await programDb.upsertProgramGrouping(albumGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.entity.type).toBe('album');
        expect(result.entity.artistUuid).toBe(artistResult.entity.uuid);
        expect(result.entity.sourceType).toBe('jellyfin');
      });
    });

    describe('update operations - local media', () => {
      test('should find existing local show and not re-insert', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        // Insert first time
        const firstResult = await programDb.upsertProgramGrouping(showGrouping);
        expect(firstResult.wasInserted).toBe(true);

        // Try to insert again with same title, library, and type
        const secondResult =
          await programDb.upsertProgramGrouping(showGrouping);

        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.wasUpdated).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });

      test('should find existing local season by title, library, year, and parent show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const showResult = await programDb.upsertProgramGrouping(showGrouping);

        const seasonGrouping = createProgramGrouping(
          'season',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            showUuid: showResult.entity.uuid,
          },
        );

        const firstResult =
          await programDb.upsertProgramGrouping(seasonGrouping);
        const secondResult =
          await programDb.upsertProgramGrouping(seasonGrouping);

        expect(firstResult.wasInserted).toBe(true);
        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });

      test('should find existing local album by title, library, year, and parent artist', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const artistGrouping = createProgramGrouping(
          'artist',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
          },
        );
        const artistResult =
          await programDb.upsertProgramGrouping(artistGrouping);

        const albumGrouping = createProgramGrouping(
          'album',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
            artistUuid: artistResult.entity.uuid,
          },
        );

        const firstResult =
          await programDb.upsertProgramGrouping(albumGrouping);
        const secondResult =
          await programDb.upsertProgramGrouping(albumGrouping);

        expect(firstResult.wasInserted).toBe(true);
        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });

      test('should update existing local show when forceUpdate is true', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
          },
        );

        const firstResult = await programDb.upsertProgramGrouping(showGrouping);
        const secondResult = await programDb.upsertProgramGrouping(
          showGrouping,
          true,
        );

        expect(firstResult.wasInserted).toBe(true);
        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.wasUpdated).toBe(true); // wasUpdated tracks DB updates
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });
    });

    describe('update operations - external media', () => {
      test('should find existing Plex show by external ID', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const firstResult = await programDb.upsertProgramGrouping(showGrouping);
        const secondResult =
          await programDb.upsertProgramGrouping(showGrouping);

        expect(firstResult.wasInserted).toBe(true);
        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });

      test('should update existing external show when canonicalId changes', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const firstResult = await programDb.upsertProgramGrouping(showGrouping);

        // Change the canonical ID to simulate a version update
        const updatedGrouping = {
          ...showGrouping,
          programGrouping: {
            ...showGrouping.programGrouping,
            canonicalId: v4(),
            summary: 'Updated summary',
          },
        };

        const secondResult =
          await programDb.upsertProgramGrouping(updatedGrouping);

        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });

      test('should update external season when parent association changes', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const show1Grouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const show1Result =
          await programDb.upsertProgramGrouping(show1Grouping);

        const show2Grouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const show2Result =
          await programDb.upsertProgramGrouping(show2Grouping);

        const seasonGrouping = createProgramGrouping(
          'season',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            showUuid: show1Result.entity.uuid,
          },
        );

        const firstResult =
          await programDb.upsertProgramGrouping(seasonGrouping);

        // Change the parent show
        const updatedSeasonGrouping = {
          ...seasonGrouping,
          programGrouping: {
            ...seasonGrouping.programGrouping,
            showUuid: show2Result.entity.uuid,
          },
        };

        const secondResult = await programDb.upsertProgramGrouping(
          updatedSeasonGrouping as any,
        );

        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
        // The parent association change should trigger an update
      });

      test('should update external album when parent association changes', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const artist1Grouping = createProgramGrouping(
          'artist',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const artist1Result =
          await programDb.upsertProgramGrouping(artist1Grouping);

        const artist2Grouping = createProgramGrouping(
          'artist',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const artist2Result =
          await programDb.upsertProgramGrouping(artist2Grouping);

        const albumGrouping = createProgramGrouping(
          'album',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            libraryId: library.uuid,
            artistUuid: artist1Result.entity.uuid,
          },
        );

        const firstResult =
          await programDb.upsertProgramGrouping(albumGrouping);

        // Change the parent artist
        const updatedAlbumGrouping = {
          ...albumGrouping,
          programGrouping: {
            ...albumGrouping.programGrouping,
            artistUuid: artist2Result.entity.uuid,
          },
        };

        const secondResult = await programDb.upsertProgramGrouping(
          updatedAlbumGrouping as any,
        );

        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });
    });

    describe('relations - genres, studios, credits, artwork', () => {
      test('should upsert genres for a show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = {
          ...createProgramGrouping('show', library.uuid, 'local', {
            mediaSourceId: library.mediaSourceId,
          }),
          genres: [createGenre(), createGenre(), createGenre()],
        };

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity).toBeDefined();
        // Genres should be upserted
        const retrievedGrouping = await programDb.getProgramGrouping(
          result.entity.uuid,
        );
        expect(retrievedGrouping).toBeDefined();
      });

      test('should upsert studios for a show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = {
          ...createProgramGrouping('show', library.uuid, 'local', {
            mediaSourceId: library.mediaSourceId,
          }),
          studios: [createStudio(), createStudio()],
        };

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity).toBeDefined();
        const retrievedGrouping = await programDb.getProgramGrouping(
          result.entity.uuid,
        );
        expect(retrievedGrouping).toBeDefined();
      });

      test('should upsert credits with artwork for a show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        // Credits are already added in helper function

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity).toBeDefined();
        expect(showGrouping.credits).toHaveLength(1);
        expect(showGrouping.credits[0].artwork).toHaveLength(1);
      });

      test('should upsert artwork for a show', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const groupingId = v4();
        const showGrouping = {
          ...createProgramGrouping('show', library.uuid, 'local', {
            uuid: groupingId,
            mediaSourceId: library.mediaSourceId,
          }),
          artwork: [createArtwork(groupingId), createArtwork(groupingId)],
        };

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity).toBeDefined();
        // Artwork should be upserted
      });

      test('should handle empty relations arrays', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const groupingId = v4();
        const programGrouping = createBaseProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            uuid: groupingId,
            mediaSourceId: library.mediaSourceId,
          },
        );

        const showGrouping: NewProgramGroupingWithRelations<'show'> = {
          programGrouping: programGrouping as any,
          externalIds: [],
          artwork: [],
          credits: [],
          genres: [],
          studios: [],
        };

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.entity).toBeDefined();
      });

      test('should update relations when forceUpdate is true', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const firstResult = await programDb.upsertProgramGrouping(showGrouping);

        // Update with new genres and studios
        const updatedGrouping = {
          ...showGrouping,
          genres: [createGenre(), createGenre()],
          studios: [createStudio(), createStudio(), createStudio()],
        };

        const secondResult = await programDb.upsertProgramGrouping(
          updatedGrouping,
          true,
        );

        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
        // Relations should be updated
      });
    });

    describe('external IDs management', () => {
      test('should insert external IDs for external media', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity.externalIds).toBeDefined();
        expect(result.entity.externalIds.length).toBeGreaterThan(0);
        expect(result.entity.externalIds[0].sourceType).toBe('plex');
      });

      test('should handle multiple external IDs for same grouping', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const groupingId = v4();
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            uuid: groupingId,
            mediaSourceId: library.mediaSourceId,
          },
        );

        // Add multiple external IDs
        showGrouping.externalIds.push({
          type: 'single',
          groupUuid: groupingId,
          uuid: v4(),
          sourceType: 'plex-guid',
          externalKey: '123',
        });

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity.externalIds.length).toBe(2);
      });

      test('should not add external IDs for local media', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(showGrouping);

        expect(result.entity.externalIds).toHaveLength(0);
      });
    });

    describe('edge cases', () => {
      test('should handle null year for local media', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            year: null,
            mediaSourceId: library.mediaSourceId,
          },
        );

        const firstResult = await programDb.upsertProgramGrouping(showGrouping);
        const secondResult =
          await programDb.upsertProgramGrouping(showGrouping);

        expect(firstResult.wasInserted).toBe(true);
        expect(secondResult.wasInserted).toBe(false);
        expect(secondResult.entity.uuid).toBe(firstResult.entity.uuid);
      });

      test('should differentiate shows with different years (local)', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const title = 'Same Title';

        const show2020 = createProgramGrouping('show', library.uuid, 'local', {
          title,
          year: 2020,
          mediaSourceId: library.mediaSourceId,
        });

        const show2024 = createProgramGrouping('show', library.uuid, 'local', {
          title,
          year: 2024,
          mediaSourceId: library.mediaSourceId,
        });

        const result2020 = await programDb.upsertProgramGrouping(show2020);
        const result2024 = await programDb.upsertProgramGrouping(show2024);

        expect(result2020.wasInserted).toBe(true);
        expect(result2024.wasInserted).toBe(true);
        expect(result2020.entity.uuid).not.toBe(result2024.entity.uuid);
      });

      test('should handle season with null index', async ({
        programDb,
        drizzle,
      }) => {
        const library = await createTestMediaSourceLibrary(drizzle);
        const showGrouping = createProgramGrouping(
          'show',
          library.uuid,
          'local',
          {
            mediaSourceId: library.mediaSourceId,
          },
        );
        const showResult = await programDb.upsertProgramGrouping(showGrouping);

        const seasonGrouping = createProgramGrouping(
          'season',
          library.uuid,
          'local',
          {
            index: null,
            showUuid: showResult.entity.uuid,
            mediaSourceId: library.mediaSourceId,
          },
        );

        const result = await programDb.upsertProgramGrouping(seasonGrouping);

        expect(result.wasInserted).toBe(true);
        expect(result.entity.index).toBeNull();
      });
    });
  });

  describe('Program State Management (trash/missing)', () => {
    test('should update programs state to missing', async ({
      programDb,
      drizzle,
    }) => {
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create test programs

      const program1Grouping: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            title: 'Test Show 1',
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const result1 = await programDb.upsertProgramGrouping(program1Grouping);

      const program2Grouping: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            title: 'Test Show 2',
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const result2 = await programDb.upsertProgramGrouping(program2Grouping);

      // Update state to missing
      await programDb.updateGroupingsState(
        [result1.entity.uuid, result2.entity.uuid],
        'missing',
      );

      // Verify state was updated
      const updated1 = await programDb.getProgramGrouping(result1.entity.uuid);
      const updated2 = await programDb.getProgramGrouping(result2.entity.uuid);

      expect(updated1?.state).toBe('missing');
      expect(updated2?.state).toBe('missing');
    });

    test('should handle empty array in updateProgramsState', async ({
      programDb,
    }) => {
      // Should not throw with empty array
      await expect(
        programDb.updateProgramsState([], 'missing'),
      ).resolves.not.toThrow();
    });

    test('should handle empty array in updateGroupingsState', async ({
      programDb,
    }) => {
      // Should not throw with empty array
      await expect(
        programDb.updateGroupingsState([], 'missing'),
      ).resolves.not.toThrow();
    });

    test('should update programs state back to active', async ({
      programDb,
      drizzle,
    }) => {
      // Create media source and library
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create test grouping
      const programGrouping: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            title: 'Test Show',
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const result = await programDb.upsertProgramGrouping(programGrouping);

      // Mark as missing
      await programDb.updateGroupingsState([result.entity.uuid], 'missing');

      // Restore to active
      await programDb.updateGroupingsState([result.entity.uuid], 'ok');

      // Verify state was updated back to active
      const updated = await programDb.getProgramGrouping(result.entity.uuid);
      expect(updated?.state).toBe('ok');
    });

    test('should batch update large number of program states', async ({
      programDb,
      drizzle,
    }) => {
      // Create media source
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create 150 groupings (more than batch size of 100)
      const groupingIds: string[] = [];
      for (let i = 0; i < 150; i++) {
        const grouping: NewProgramGroupingWithRelations = {
          programGrouping: createBaseProgramGrouping(
            'show',
            library.uuid,
            'plex',
            {
              title: `Test Show ${i}`,
              mediaSourceId: library.mediaSourceId,
            },
          ),
          externalIds: [],
          genres: [],
          studios: [],
          artwork: [],
          credits: [],
        };

        const result = await programDb.upsertProgramGrouping(grouping);
        groupingIds.push(result.entity.uuid);
      }

      // Update all states (should batch automatically)
      await programDb.updateGroupingsState(groupingIds, 'missing');

      // Verify all were updated
      for (const id of groupingIds.slice(0, 10)) {
        // Check first 10
        const grouping = await programDb.getProgramGrouping(id);
        expect(grouping?.state).toBe('missing');
      }
    });
  });

  describe('Program External ID Operations', () => {
    test('should lookup program by external ID', async ({
      programDb,
      drizzle,
    }) => {
      // Create media source
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create grouping with external ID
      const programGrouping = createBaseProgramGrouping(
        'show',
        library.uuid,
        'plex',
        {
          title: `Test Show`,
          mediaSourceId: library.mediaSourceId,
        },
      );
      const externalId = createGroupingExternalId(
        programGrouping.uuid,
        'plex',
        library.mediaSourceId,
        programGrouping.externalKey,
      );

      const grouping: NewProgramGroupingWithRelations = {
        programGrouping,
        externalIds: [externalId],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const result = await programDb.upsertProgramGrouping(grouping);

      // Lookup by external ID
      const found = await programDb.getProgramGroupingByExternalId({
        externalSourceId: externalId.mediaSourceId,
        externalKey: externalId.externalKey,
        sourceType: 'plex',
      });

      expect(found).toBeDefined();
      expect(found?.uuid).toBe(result.entity.uuid);
      expect(found?.title).toBe('Test Show');
    });
  });

  describe('Program Parent-Child Relationships', () => {
    // Skip for now - this method requires inserting a program for each child grouping
    // in order to work
    test.skip('should get children of a show', async ({
      programDb,
      drizzle,
    }) => {
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create show
      const showGrouping: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const showResult = await programDb.upsertProgramGrouping(showGrouping);

      // Create seasons
      const season1: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'season',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            index: 1,
            showUuid: showGrouping.programGrouping.uuid,
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const season2: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'season',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
            index: 2,
            showUuid: showGrouping.programGrouping.uuid,
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      await programDb.upsertProgramGrouping(season1);
      await programDb.upsertProgramGrouping(season2);

      // Get children
      const children = await programDb.getChildren(
        showResult.entity.uuid,
        'show',
      );

      expect(children.results).toHaveLength(2);
      expect(children.results.some((c) => c.title === 'Season 1')).toBe(true);
      expect(children.results.some((c) => c.title === 'Season 2')).toBe(true);
    });

    test('should get child counts for groupings', async ({
      programDb,
      drizzle,
    }) => {
      // Create media source
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create show
      const showGrouping: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const showResult = await programDb.upsertProgramGrouping(showGrouping);

      // Create 3 seasons
      for (let i = 1; i <= 3; i++) {
        const season: NewProgramGroupingWithRelations = {
          programGrouping: createBaseProgramGrouping(
            'season',
            library.uuid,
            'plex',
            {
              mediaSourceId: library.mediaSourceId,
              index: i,
              showUuid: showGrouping.programGrouping.uuid,
            },
          ),
          externalIds: [],
          genres: [],
          studios: [],
          artwork: [],
          credits: [],
        };
        await programDb.upsertProgramGrouping(season);
      }

      // Get child counts
      const counts = await programDb.getProgramGroupingChildCounts([
        showResult.entity.uuid,
      ]);

      const showCount = counts[showResult.entity.uuid];
      expect(showCount?.childCount).toBe(3);
    });

    test('should get descendants of a show', async ({ programDb, drizzle }) => {
      // Create media source
      const library = await createTestMediaSourceLibrary(drizzle);

      // Create show
      const showGrouping: NewProgramGroupingWithRelations = {
        programGrouping: createBaseProgramGrouping(
          'show',
          library.uuid,
          'plex',
          {
            mediaSourceId: library.mediaSourceId,
          },
        ),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      const showResult = await programDb.upsertProgramGrouping(showGrouping);

      // Create season with episodes would go here
      const episode: NewProgramWithRelations = {
        program: createBaseProgram('episode', library.uuid, 'plex', {
          mediaSourceId: library.mediaSourceId,
          tvShowUuid: showGrouping.programGrouping.uuid,
          episode: 1,
        }),
        externalIds: [],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
        versions: [],
        subtitles: [],
      };

      await programDb.upsertPrograms([episode]);

      // await programDb.upsertProgramGrouping(season);

      // Get descendants (should include seasons)
      const descendants = await programDb.getProgramGroupingDescendants(
        showResult.entity.uuid,
      );

      expect(descendants.length).toBeGreaterThan(0);
      expect(descendants[0].uuid).toEqual(episode.program.uuid);
    });
  });

  describe('Idempotency and Concurrent Operations', () => {
    test('should handle multiple upserts of same grouping idempotently', async ({
      programDb,
      drizzle,
    }) => {
      // Create media source
      const library = await createTestMediaSourceLibrary(drizzle);

      const programGrouping = createBaseProgramGrouping(
        'show',
        library.uuid,
        'plex',
        {
          mediaSourceId: library.mediaSourceId,
        },
      );
      const grouping: NewProgramGroupingWithRelations = {
        programGrouping,
        externalIds: [
          createGroupingExternalId(
            programGrouping.uuid,
            'plex',
            programGrouping.mediaSourceId,
            programGrouping.externalKey,
          ),
        ],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      // First upsert
      const result1 = await programDb.upsertProgramGrouping(grouping);
      expect(result1.wasInserted).toBe(true);

      // Second upsert with same external ID
      const result2 = await programDb.upsertProgramGrouping(grouping);
      expect(result2.wasInserted).toBe(false);
      expect(result2.entity.uuid).toBe(result1.entity.uuid);

      // Third upsert
      const result3 = await programDb.upsertProgramGrouping(grouping);
      expect(result3.wasInserted).toBe(false);
      expect(result3.entity.uuid).toBe(result1.entity.uuid);
    });

    test('should handle forceUpdate correctly', async ({
      programDb,
      drizzle,
    }) => {
      // Create media source
      const library = await createTestMediaSourceLibrary(drizzle);

      const programGrouping = createBaseProgramGrouping(
        'show',
        library.uuid,
        'local',
        {
          mediaSourceId: library.mediaSourceId,
        },
      );
      const grouping: NewProgramGroupingWithRelations = {
        programGrouping,
        externalIds: [
          // createGroupingExternalId(
          //   programGrouping.uuid,
          //   'plex',
          //   programGrouping.mediaSourceId,
          //   programGrouping.externalKey,
          // ),
        ],
        genres: [],
        studios: [],
        artwork: [],
        credits: [],
      };

      // Initial insert
      const result1 = await programDb.upsertProgramGrouping(grouping);

      // Update with forceUpdate
      const updatedGrouping: NewProgramGroupingWithRelations = {
        ...grouping,
        programGrouping: {
          ...grouping.programGrouping,
          title: 'Updated Title',
        },
      };

      const result2 = await programDb.upsertProgramGrouping(
        updatedGrouping,
        true, // forceUpdate
      );

      expect(result2.entity.uuid).toBe(result1.entity.uuid);
      expect(result2.entity.title).toBe('Updated Title');
    });
  });
});
