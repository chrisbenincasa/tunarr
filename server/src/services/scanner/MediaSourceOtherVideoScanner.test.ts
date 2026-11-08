import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { ProgramState } from '../../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import type { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import { describe, expect, test, vi } from 'vitest';
import type { HasMediaSourceInfo, OtherVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceOtherVideoScanner } from './MediaSourceOtherVideoScanner.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';

type MockApiClient = MediaSourceApiClient;

class TestOtherVideoScanner extends MediaSourceOtherVideoScanner<
  'jellyfin',
  MockApiClient,
  OtherVideo
> {
  readonly type = 'other_videos' as const;
  readonly mediaSourceType = 'jellyfin' as const;

  getApiClient = vi
    .fn<() => Promise<MockApiClient>>()
    .mockResolvedValue({} as MockApiClient);
  getLibrarySize = vi.fn().mockResolvedValue(0);
  getSubtitles = vi.fn();
  getVideos = vi.fn<() => AsyncIterable<OtherVideo>>();

  scanSingleInternal = vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  constructor(
    mediaSourceDB: MediaSourceDB,
    programDB: IProgramDB,
    searchService: MeilisearchService,
    progress: MediaSourceProgressService,
  ) {
    super(
      mediaSourceDB,
      programDB,
      searchService,
      progress,
      {} as never,
      {} as never,
    );
  }

  exposeScanInternal(ctx: ScanContext<MockApiClient>): Promise<void> {
    return this.scanInternal(ctx);
  }
}

function makeLibrary(): MediaSourceLibrary {
  return {
    uuid: 'lib1',
    name: 'Library',
    mediaSourceId: 'ms1',
    externalKey: 'ext1',
    enabled: true,
  } as MediaSourceLibrary;
}

function makeContext(
  scanner: TestOtherVideoScanner,
): ScanContext<MockApiClient> {
  return {
    library: makeLibrary(),
    mediaSource: {} as MediaSourceOrm,
    force: false,
    apiClient: {} as MockApiClient,
    scannedEntities: 0,
    totalEntities: 0,
  };
}

function makeProgressService(): MediaSourceProgressService {
  return {
    scanStarted: vi.fn(),
    scanProgress: vi.fn(),
    scanEnded: vi.fn(),
  } as unknown as MediaSourceProgressService;
}

function makeSut() {
  const programDB = {
    getProgramInfoForMediaSourceLibrary: vi.fn().mockResolvedValue({
      // An item already persisted but NOT seen during this scan: would be
      // marked missing unless a pathFilter narrows the scan.
      ghost: {
        uuid: 'ghost-uuid',
        canonicalId: null,
        libraryId: null,
        externalKey: 'ghost',
      },
    }),
    updateProgramsState: vi.fn().mockResolvedValue(undefined),
  } as unknown as IProgramDB;

  const searchService = {
    updatePrograms: vi.fn().mockResolvedValue(undefined),
  } as unknown as MeilisearchService;

  const progress = makeProgressService();
  const scanner = new TestOtherVideoScanner(
    {} as MediaSourceDB,
    programDB,
    searchService,
    progress,
  );

  return { scanner, programDB, searchService, progress };
}

describe('MediaSourceOtherVideoScanner.pathFilter', () => {
  test('a pathFilter narrows the scan to the single matching item', async () => {
    const { scanner, programDB } = makeSut();
    scanner.getVideos.mockImplementation(async function* () {
      yield { externalId: 'target' } as OtherVideo;
      yield { externalId: 'other' } as OtherVideo;
    });

    await scanner.exposeScanInternal({
      ...makeContext(scanner),
      pathFilter: 'target',
    });

    // Only the matching item is processed...
    expect(scanner.scanSingleInternal).toHaveBeenCalledTimes(1);
    expect(
      (scanner.scanSingleInternal.mock.calls[0]?.[1] as OtherVideo).externalId,
    ).toBe('target');
    // ...and the mark-missing pass is skipped entirely (the ghost item that
    // wasn't seen must not be marked missing during a targeted scan).
    expect(programDB.updateProgramsState).not.toHaveBeenCalled();
  });

  test('without a pathFilter every item is scanned and misses are marked', async () => {
    const { scanner, programDB } = makeSut();
    scanner.getVideos.mockImplementation(async function* () {
      yield { externalId: 'target' } as OtherVideo;
      yield { externalId: 'other' } as OtherVideo;
    });

    await scanner.exposeScanInternal(makeContext(scanner));

    expect(scanner.scanSingleInternal).toHaveBeenCalledTimes(2);
    // The ghost item was persisted before but never seen -> marked missing.
    expect(programDB.updateProgramsState).toHaveBeenCalledWith(
      ['ghost-uuid'],
      'missing',
    );
  });
});

class ItemTestOtherVideoScanner extends MediaSourceOtherVideoScanner<
  'jellyfin',
  MockApiClient,
  OtherVideo
> {
  readonly type = 'other_videos' as const;
  readonly mediaSourceType = 'jellyfin' as const;

  getApiClient = vi
    .fn<() => Promise<MockApiClient>>()
    .mockResolvedValue({} as MockApiClient);
  getLibrarySize = vi.fn().mockResolvedValue(0);
  getSubtitles = vi.fn();
  getVideos = vi.fn<() => AsyncIterable<OtherVideo>>();
  scanVideoById =
    vi.fn<() => Promise<Result<OtherVideo & HasMediaSourceInfo>>>();

  exposeScanSingleInternal(
    ctx: ScanContext<MockApiClient>,
    video: OtherVideo,
    existing: ProgramCanonicalIdLookupResult,
  ): Promise<void> {
    return this.scanSingleInternal(ctx, video, existing);
  }
}

describe('MediaSourceOtherVideoScanner unchanged videos', () => {
  function makeItemSut() {
    const programDB = {
      upsertPrograms: vi.fn().mockResolvedValue([]),
    } as unknown as IProgramDB;
    const minter = {
      mintOtherVideo: vi.fn().mockReturnValue({ program: {}, subtitles: [] }),
    } as unknown as ProgramDaoMinter;

    const scanner = new ItemTestOtherVideoScanner(
      {} as MediaSourceDB,
      programDB,
      {} as MeilisearchService,
      makeProgressService(),
      minter,
      {} as ExternalSubtitleDownloader,
    );
    scanner.scanVideoById.mockResolvedValue(
      Result.success({
        externalId: 'video',
        canonicalId: 'same-canonical-id',
      } as OtherVideo & HasMediaSourceInfo),
    );

    const ctx: ScanContext<MockApiClient> = {
      library: makeLibrary(),
      mediaSource: { replacePaths: [] } as unknown as MediaSourceWithRelations,
      force: false,
      apiClient: {} as MockApiClient,
      scannedEntities: 0,
      totalEntities: 0,
    };

    return { scanner, programDB, ctx };
  }

  function existingVideo(state: ProgramState): ProgramCanonicalIdLookupResult {
    return {
      uuid: 'video-uuid',
      canonicalId: 'same-canonical-id',
      libraryId: 'lib1',
      externalKey: 'video',
      state,
    };
  }

  test('skips saving a live video whose metadata is unchanged', async () => {
    const { scanner, programDB, ctx } = makeItemSut();

    await scanner.exposeScanSingleInternal(
      ctx,
      { externalId: 'video' } as OtherVideo,
      existingVideo('ok'),
    );

    expect(programDB.upsertPrograms).not.toHaveBeenCalled();
  });

  test('saves a trashed video the server lists again, even if unchanged', async () => {
    const { scanner, programDB, ctx } = makeItemSut();

    await scanner.exposeScanSingleInternal(
      ctx,
      { externalId: 'video' } as OtherVideo,
      existingVideo('missing'),
    );

    expect(programDB.upsertPrograms).toHaveBeenCalledTimes(1);
  });
});
