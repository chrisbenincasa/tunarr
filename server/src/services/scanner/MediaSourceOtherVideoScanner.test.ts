import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import type { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import { describe, expect, test, vi } from 'vitest';
import type { OtherVideo } from '../../types/Media.ts';
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
