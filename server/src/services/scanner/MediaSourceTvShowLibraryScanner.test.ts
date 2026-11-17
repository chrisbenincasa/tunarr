import { faker } from '@faker-js/faker';
import type { ProgramGrouping as ApiProgramGrouping } from '@tunarr/types';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { eq, inArray } from 'drizzle-orm';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect, vi } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import type { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import type { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { ProgramDB } from '../../db/ProgramDB.ts';
import { BasicProgramRepository } from '../../db/program/BasicProgramRepository.ts';
import { ProgramExternalIdRepository } from '../../db/program/ProgramExternalIdRepository.ts';
import { ProgramGroupingRepository } from '../../db/program/ProgramGroupingRepository.ts';
import { ProgramGroupingUpsertRepository } from '../../db/program/ProgramGroupingUpsertRepository.ts';
import { ProgramMetadataRepository } from '../../db/program/ProgramMetadataRepository.ts';
import { ProgramSearchRepository } from '../../db/program/ProgramSearchRepository.ts';
import { ProgramStateRepository } from '../../db/program/ProgramStateRepository.ts';
import { ProgramUpsertRepository } from '../../db/program/ProgramUpsertRepository.ts';
import type { MediaSourceId, ProgramState } from '../../db/schema/base.ts';
import type { NewProgramGroupingWithRelations } from '../../db/schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import {
  MediaSource,
  type MediaSourceOrm,
} from '../../db/schema/MediaSource.ts';
import {
  MediaSourceLibrary,
  type MediaSourceLibraryOrm,
} from '../../db/schema/MediaSourceLibrary.ts';
import { Program } from '../../db/schema/Program.ts';
import { ProgramGrouping } from '../../db/schema/ProgramGrouping.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import { globalOptions, setGlobalOptions } from '../../globals.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import type {
  JellyfinEpisode,
  JellyfinSeason,
  JellyfinShow,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { FileSystemService } from '../FileSystemService.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { MediaSourceTvShowLibraryScanner } from './MediaSourceTvShowLibraryScanner.ts';

type Fixture = {
  drizzle: DrizzleDBAccess;
  programDb: IProgramDB;
};

const test = baseTest.extend<Fixture>({
  drizzle: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    setGlobalOptions({
      database: dbResult.path,
      log_level: 'error',
      verbose: 0,
    });
    await bootstrapTunarr();
    const drizzle = DBAccess.instance.drizzle;
    if (!drizzle) {
      throw new Error('Drizzle is not initialized');
    }
    await use(drizzle);
    await dbResult.cleanup();
  },
  programDb: async ({ drizzle }, use) => {
    const db = DBAccess.instance.db;
    if (!db) {
      throw new Error('Kysely is not initialized');
    }
    const metadataRepo = new ProgramMetadataRepository(
      drizzle,
      new FileSystemService(globalOptions()),
    );
    const externalIdRepo = new ProgramExternalIdRepository(db, drizzle);
    await use(
      new ProgramDB(
        new BasicProgramRepository(db, drizzle),
        new ProgramGroupingRepository(db, drizzle),
        externalIdRepo,
        new ProgramUpsertRepository(drizzle, externalIdRepo, metadataRepo),
        metadataRepo,
        new ProgramGroupingUpsertRepository(db, drizzle, metadataRepo),
        new ProgramSearchRepository(db, drizzle),
        new ProgramStateRepository(drizzle),
      ),
    );
  },
});

type Seeded = {
  mediaSource: MediaSourceOrm;
  library: MediaSourceLibraryOrm;
  showUuid: string;
  seasonUuid: string;
  episodeUuid: string;
};

const showKey = 'show-1';
const seasonKey = 'season-1';
const episodeKey = 'episode-1';

async function seedShowWithOneEpisode(
  drizzle: DrizzleDBAccess,
  episodeState: ProgramState,
  groupingState: ProgramState,
): Promise<Seeded> {
  const mediaSource = {
    uuid: v4() as MediaSourceId,
    name: tag(faker.string.alpha(10)),
    type: 'jellyfin',
    createdAt: +dayjs(),
    updatedAt: +dayjs(),
    uri: 'http://localhost:8096',
    accessToken: 'test-token',
    clientIdentifier: null,
    index: 0,
    sendChannelUpdates: false,
    sendGuideUpdates: false,
    username: null,
    userId: null,
    mediaType: null,
  } satisfies MediaSourceOrm;
  await drizzle.insert(MediaSource).values(mediaSource);

  const library = {
    uuid: v4(),
    name: faker.word.words(2),
    mediaSourceId: mediaSource.uuid,
    mediaType: 'shows' as const,
    lastScannedAt: null,
    externalKey: faker.string.alphanumeric(10),
    enabled: true,
  } satisfies MediaSourceLibraryOrm;
  await drizzle.insert(MediaSourceLibrary).values(library);

  const grouping = {
    sourceType: 'jellyfin' as const,
    mediaSourceId: mediaSource.uuid,
    libraryId: library.uuid,
    state: groupingState,
  };

  const showUuid = v4();
  await drizzle.insert(ProgramGrouping).values({
    ...grouping,
    uuid: showUuid,
    title: 'Show',
    type: 'show',
    externalKey: showKey,
    canonicalId: `canonical-${showKey}`,
  });

  const seasonUuid = v4();
  await drizzle.insert(ProgramGrouping).values({
    ...grouping,
    uuid: seasonUuid,
    title: 'Season 1',
    type: 'season',
    externalKey: seasonKey,
    canonicalId: `canonical-${seasonKey}`,
    showUuid,
  });

  const episodeUuid = v4();
  await drizzle.insert(Program).values({
    uuid: episodeUuid,
    duration: 30000,
    type: 'episode',
    sourceType: 'jellyfin',
    externalKey: episodeKey,
    externalSourceId: mediaSource.uuid,
    mediaSourceId: mediaSource.uuid,
    libraryId: library.uuid,
    canonicalId: `canonical-${episodeKey}`,
    title: 'Episode 1',
    state: episodeState,
    seasonUuid,
    tvShowUuid: showUuid,
  });

  return { mediaSource, library, showUuid, seasonUuid, episodeUuid };
}

/**
 * A server that lists one show with one season. The season has no episodes,
 * like a Jellyfin season kept around after its episodes are deleted.
 */
class EmptySeasonScanner extends MediaSourceTvShowLibraryScanner<
  'jellyfin',
  MediaSourceApiClient,
  JellyfinShow,
  JellyfinSeason,
  JellyfinEpisode
> {
  readonly mediaSourceType = 'jellyfin' as const;

  constructor(
    programDb: IProgramDB,
    searchService: MeilisearchService,
    mediaSource: MediaSourceOrm,
    programGroupingMinter: ProgramGroupingMinter = {} as ProgramGroupingMinter,
  ) {
    super(
      {
        getById: () => Promise.resolve(mediaSource),
        setLibraryLastScannedTime: () => Promise.resolve(),
      } as unknown as MediaSourceDB,
      programDb,
      programGroupingMinter,
      {} as ProgramDaoMinter,
      searchService,
      {
        scanStarted: vi.fn(),
        scanProgress: vi.fn(),
        scanEnded: vi.fn(),
      } as unknown as MediaSourceProgressService,
      {
        execute: (uuid: string) => programDb.getProgramGrouping(uuid),
      } as unknown as GetProgramGroupingById,
      {} as ExternalSubtitleDownloader,
    );
  }

  protected getApiClient(): Promise<MediaSourceApiClient> {
    return Promise.resolve({} as MediaSourceApiClient);
  }

  protected getLibrarySize(): Promise<number> {
    return Promise.resolve(1);
  }

  protected getSubtitles(): never {
    throw new Error('not implemented for test');
  }

  protected async *getTvShowLibraryContents(): AsyncIterable<JellyfinShow> {
    yield { externalId: showKey } as JellyfinShow;
  }

  protected async *getTvShowSeasons(): AsyncIterable<JellyfinSeason> {
    yield { externalId: seasonKey } as JellyfinSeason;
  }

  protected async *getSeasonEpisodes(): AsyncIterable<JellyfinEpisode> {}

  protected getEntityExternalKey(
    item: JellyfinShow | JellyfinSeason | JellyfinEpisode,
  ): string {
    return item.externalId;
  }

  protected getFullEpisodeMetadata(): Promise<Result<JellyfinEpisode>> {
    throw new Error('not implemented for test');
  }

  protected getFullTvShowMetadata(
    externalId: string,
  ): Promise<Result<JellyfinShow>> {
    return Promise.resolve(
      Result.success({
        externalId,
        canonicalId: `canonical-${externalId}`,
      } as JellyfinShow),
    );
  }

  protected getFullTvSeasonMetadata(
    externalId: string,
  ): Promise<Result<JellyfinSeason>> {
    return Promise.resolve(
      Result.success({
        externalId,
        canonicalId: `canonical-${externalId}`,
      } as JellyfinSeason),
    );
  }

  protected isShowT(grouping: ApiProgramGrouping): grouping is JellyfinShow {
    return grouping.type === 'show';
  }

  protected isSeasonT(
    grouping: ApiProgramGrouping,
  ): grouping is JellyfinSeason {
    return grouping.type === 'season';
  }
}

function makeSearchService() {
  const updatePrograms = vi.fn().mockResolvedValue(undefined);
  const searchService = {
    indexShow: vi.fn().mockResolvedValue(undefined),
    indexSeason: vi.fn().mockResolvedValue(undefined),
    updatePrograms,
  } as unknown as MeilisearchService;
  return { searchService, updatePrograms };
}

async function groupingStates(drizzle: DrizzleDBAccess, ids: string[]) {
  const rows = await drizzle
    .select({ uuid: ProgramGrouping.uuid, state: ProgramGrouping.state })
    .from(ProgramGrouping)
    .where(inArray(ProgramGrouping.uuid, ids));
  return Object.fromEntries(rows.map(({ uuid, state }) => [uuid, state]));
}

describe('MediaSourceTvShowLibraryScanner grouping trash state', () => {
  test('trashes a season the server still lists once its last episode is gone', async ({
    drizzle,
    programDb,
  }) => {
    const seeded = await seedShowWithOneEpisode(drizzle, 'ok', 'ok');
    const { searchService, updatePrograms } = makeSearchService();
    const scanner = new EmptySeasonScanner(
      programDb,
      searchService,
      seeded.mediaSource,
    );

    await scanner.scan({ library: seeded.library, force: false });

    const episode = await drizzle.query.program.findFirst({
      where: eq(Program.uuid, seeded.episodeUuid),
    });
    expect(episode?.state).toBe('missing');
    expect(
      await groupingStates(drizzle, [seeded.showUuid, seeded.seasonUuid]),
    ).toEqual({
      [seeded.showUuid]: 'missing',
      [seeded.seasonUuid]: 'missing',
    });
    expect(updatePrograms).toHaveBeenCalledWith(
      expect.arrayContaining([
        { id: seeded.showUuid, state: 'missing' },
        { id: seeded.seasonUuid, state: 'missing' },
      ]),
    );
  });

  test('restores a trashed season once an episode under it is live again', async ({
    drizzle,
    programDb,
  }) => {
    const seeded = await seedShowWithOneEpisode(drizzle, 'ok', 'missing');
    const { searchService, updatePrograms } = makeSearchService();
    const scanner = new EmptySeasonScanner(
      programDb,
      searchService,
      seeded.mediaSource,
    );

    // The path filter keeps the episode pass from trashing the live episode.
    await scanner.scan({
      library: seeded.library,
      force: false,
      pathFilter: showKey,
    });

    expect(
      await groupingStates(drizzle, [seeded.showUuid, seeded.seasonUuid]),
    ).toEqual({
      [seeded.showUuid]: 'ok',
      [seeded.seasonUuid]: 'ok',
    });
    expect(updatePrograms).toHaveBeenCalledWith(
      expect.arrayContaining([
        { id: seeded.showUuid, state: 'ok' },
        { id: seeded.seasonUuid, state: 'ok' },
      ]),
    );
  });

  test('a single-show rescan keeps an empty show in the trash', async ({
    drizzle,
    programDb,
  }) => {
    const seeded = await seedShowWithOneEpisode(drizzle, 'missing', 'missing');
    const { searchService } = makeSearchService();

    // A forced rescan upserts the show with state 'ok', as a real one does.
    const now = +dayjs();
    const minter = {
      mintForMediaSourceShow: (): NewProgramGroupingWithRelations<'show'> => ({
        programGrouping: {
          uuid: seeded.showUuid,
          canonicalId: `canonical-${showKey}`,
          createdAt: now,
          updatedAt: now,
          title: 'Show',
          type: 'show',
          sourceType: 'jellyfin',
          externalKey: showKey,
          mediaSourceId: seeded.mediaSource.uuid,
          libraryId: seeded.library.uuid,
          artistUuid: null,
          showUuid: null,
          state: 'ok',
        },
        externalIds: [],
        artwork: [],
        credits: [],
        genres: [],
        studios: [],
        tags: [],
      }),
    } as unknown as ProgramGroupingMinter;

    const scanner = new EmptySeasonScanner(
      programDb,
      searchService,
      seeded.mediaSource,
      minter,
    );

    const result = await scanner.scanSingle({
      library: seeded.library,
      force: true,
      externalId: showKey,
    });

    expect(result.isSuccess()).toBe(true);
    expect(await groupingStates(drizzle, [seeded.showUuid])).toEqual({
      [seeded.showUuid]: 'missing',
    });
  });
});
