import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaSourceId } from '../db/schema/base.ts';
import { SubtitleExtractorTask } from './SubtitleExtractorTask.ts';

vi.mock('@/util/logging/LoggerFactory.js', () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    setBindings: vi.fn(),
  };
  return {
    LoggerFactory: {
      isInitialized: true,
      root: logger,
      child: () => logger,
    },
  };
});

// The task only needs TVGuideService as an injection token here, and importing
// the real one drags the DI container in through the scheduler, which cannot be
// constructed mid-import.
vi.mock('../services/TvGuideService.ts', () => ({
  TVGuideService: class {},
}));

// Used by PathCalculator (shared-storage lookups) and by the task's own
// check for whether an already-recorded subtitle file is still there.
const mockFileExists = vi.fn<(p: string) => Promise<boolean>>();
vi.mock('../util/fsUtil.ts', () => ({
  fileExists: (p: string) => mockFileExists(p),
}));

const MEDIA_SOURCE_ID = 'media-source-1' as MediaSourceId;
const PROGRAM_ID = 'program-1';
const CHANNEL_ID = 'channel-1';
const SOURCE_SUBTITLE_PATH = '/data/media/movie.eng.srt';
const SHARED_SUBTITLE_PATH = '/mnt/media/movie.eng.srt';
const CACHED_SUBTITLE_PATH = '/tmp/test-tunarr/cache/subtitles/ab/cd/abcd.srt';
const SUBTITLE_KEY = '/Videos/jf-item-1/jf-item-1/Subtitles/0/Stream.srt';

type SubtitleRow = {
  uuid: string;
  subtitleType: 'embedded' | 'sidecar';
  codec: string;
  language: string;
  path?: string | null;
  sourcePath?: string | null;
  sourceKey?: string | null;
  streamIndex?: number | null;
  isExtracted?: boolean;
};

function makeSubtitle(row: SubtitleRow) {
  return {
    default: false,
    forced: false,
    isExtracted: false,
    path: null,
    programId: PROGRAM_ID,
    sdh: false,
    sourceKey: null,
    sourcePath: null,
    streamIndex: null,
    ...row,
  };
}

type Harness = ReturnType<typeof makeHarness>;

function makeHarness(opts: {
  subtitles: SubtitleRow[];
  sourceType?: 'jellyfin' | 'emby' | 'plex';
  replacePaths?: { localPath: string; serverPath: string }[];
  subtitlesEnabled?: boolean;
  enableSubtitleExtraction?: boolean;
  downloadedPath?: string;
}) {
  const sourceType = opts.sourceType ?? 'jellyfin';

  const mediaSource = {
    uuid: MEDIA_SOURCE_ID,
    name: 'Test Source',
    type: sourceType,
    uri: 'http://localhost:8096',
    accessToken: 'token',
    libraries: [],
    paths: [],
    replacePaths: opts.replacePaths ?? [],
  };

  const dbProgram = {
    uuid: PROGRAM_ID,
    externalKey: 'jf-item-1',
    mediaSourceId: MEDIA_SOURCE_ID,
    sourceType,
    subtitles: opts.subtitles.map(makeSubtitle),
    externalIds: [],
  };

  const setSubtitlePath = vi.fn<(uuid: string, path: string) => Promise<void>>(
    () => Promise.resolve(),
  );
  const getSubtitlesByPath = vi.fn(() => Promise.resolve('subtitle contents'));
  const getSubtitlesByKey = vi.fn(() => Promise.resolve('subtitle contents'));

  // Stands in for the real downloader: runs the fetch callback the task hands
  // it, so the test also covers which client method the task reaches for.
  const downloadSubtitlesIfNecessary = vi.fn(
    async (
      _item: unknown,
      _details: unknown,
      cb: (args: { extension: string }) => Promise<unknown>,
    ) => {
      await cb({ extension: 'srt' });
      return opts.downloadedPath;
    },
  );

  const apiClient = {
    getSubtitlesByPath,
    getSubtitles: getSubtitlesByKey,
  };

  const task = new SubtitleExtractorTask(
    {
      get: () => Promise.resolve({}),
      getAllChannelGuides: () =>
        Promise.resolve([
          {
            id: CHANNEL_ID,
            programs: [
              {
                type: 'content',
                id: PROGRAM_ID,
                program: {
                  title: 'Test Movie',
                  externalId: 'jf-item-1',
                  mediaSourceId: MEDIA_SOURCE_ID,
                  sourceType,
                },
              },
            ],
          },
        ]),
    } as never,
    {
      getChannel: () =>
        Promise.resolve({
          uuid: CHANNEL_ID,
          subtitlesEnabled: opts.subtitlesEnabled ?? true,
        }),
    } as never,
    {
      getStream: () => Promise.reject(new Error('should not be called')),
    } as never,
    { getAll: () => Promise.resolve([mediaSource]) } as never,
    {
      ffmpegSettings: () => ({
        enableSubtitleExtraction: opts.enableSubtitleExtraction ?? false,
      }),
    } as never,
    { databaseDirectory: '/tmp/test-tunarr' } as never,
    {
      getProgramById: () => Promise.resolve(dbProgram),
      setSubtitlePath,
    } as never,
    { downloadSubtitlesIfNecessary } as never,
    {
      getJellyfinApiClientForMediaSource: () => Promise.resolve(apiClient),
      getEmbyApiClientForMediaSource: () => Promise.resolve(apiClient),
      getPlexApiClientForMediaSource: () => Promise.resolve(apiClient),
    } as never,
  );

  return {
    task,
    dbProgram,
    setSubtitlePath,
    downloadSubtitlesIfNecessary,
    getSubtitlesByPath,
    getSubtitlesByKey,
  };
}

async function run(harness: Harness) {
  const result = await harness.task.run({});
  expect(result.isSuccess()).toBe(true);
}

describe('SubtitleExtractorTask external subtitle top-up', () => {
  beforeEach(() => {
    mockFileExists.mockReset();
    mockFileExists.mockResolvedValue(false);
  });

  it('leaves a sidecar alone when its recorded file is still on disk', async () => {
    mockFileExists.mockImplementation((p) =>
      Promise.resolve(p === CACHED_SUBTITLE_PATH),
    );

    const harness = makeHarness({
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          path: CACHED_SUBTITLE_PATH,
          sourceKey: SUBTITLE_KEY,
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).not.toHaveBeenCalled();
    expect(harness.setSubtitlePath).not.toHaveBeenCalled();
  });

  it('prefers storage shared with the media source over downloading', async () => {
    mockFileExists.mockImplementation((p) =>
      Promise.resolve(p === SHARED_SUBTITLE_PATH),
    );

    const harness = makeHarness({
      replacePaths: [{ localPath: '/mnt/media', serverPath: '/data/media' }],
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourcePath: SOURCE_SUBTITLE_PATH,
          sourceKey: SUBTITLE_KEY,
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).not.toHaveBeenCalled();
    expect(harness.setSubtitlePath).toHaveBeenCalledWith(
      'sub-1',
      SHARED_SUBTITLE_PATH,
    );
  });

  it('downloads a sidecar the scan never managed to fetch', async () => {
    const harness = makeHarness({
      downloadedPath: CACHED_SUBTITLE_PATH,
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourcePath: SOURCE_SUBTITLE_PATH,
          sourceKey: SUBTITLE_KEY,
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).toHaveBeenCalledTimes(1);
    expect(harness.setSubtitlePath).toHaveBeenCalledWith(
      'sub-1',
      CACHED_SUBTITLE_PATH,
    );
    // The in-memory row is kept in step with what was persisted.
    expect(harness.dbProgram.subtitles[0].path).toBe(CACHED_SUBTITLE_PATH);
  });

  it('re-downloads a sidecar whose cached copy has been deleted', async () => {
    const harness = makeHarness({
      downloadedPath: CACHED_SUBTITLE_PATH,
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          // Recorded during a previous scan, but the file is gone.
          path: CACHED_SUBTITLE_PATH,
          sourceKey: SUBTITLE_KEY,
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).toHaveBeenCalledTimes(1);
  });

  it('addresses Jellyfin and Emby subtitles by their delivery route', async () => {
    for (const sourceType of ['jellyfin', 'emby'] as const) {
      const harness = makeHarness({
        sourceType,
        downloadedPath: CACHED_SUBTITLE_PATH,
        subtitles: [
          {
            uuid: 'sub-1',
            subtitleType: 'sidecar',
            codec: 'subrip',
            language: 'eng',
            sourceKey: SUBTITLE_KEY,
          },
        ],
      });

      await run(harness);

      expect(harness.getSubtitlesByPath).toHaveBeenCalledWith(SUBTITLE_KEY);
    }
  });

  it('addresses Plex subtitles by their stream key', async () => {
    const harness = makeHarness({
      sourceType: 'plex',
      downloadedPath: CACHED_SUBTITLE_PATH,
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourceKey: '/library/streams/12345',
        },
      ],
    });

    await run(harness);

    expect(harness.getSubtitlesByKey).toHaveBeenCalledWith(
      '/library/streams/12345',
    );
  });

  it('does not record a path when the download fails', async () => {
    const harness = makeHarness({
      // The downloader returns nothing when it could not write a file.
      downloadedPath: undefined,
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourceKey: SUBTITLE_KEY,
        },
      ],
    });

    await run(harness);

    expect(harness.setSubtitlePath).not.toHaveBeenCalled();
  });

  it('ignores embedded subtitles, which are extracted rather than fetched', async () => {
    const harness = makeHarness({
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'embedded',
          codec: 'subrip',
          language: 'eng',
          streamIndex: 2,
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).not.toHaveBeenCalled();
  });

  it('skips a sidecar with no way to reach it', async () => {
    const harness = makeHarness({
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).not.toHaveBeenCalled();
    expect(harness.setSubtitlePath).not.toHaveBeenCalled();
  });

  it('skips channels that have subtitles turned off', async () => {
    const harness = makeHarness({
      subtitlesEnabled: false,
      downloadedPath: CACHED_SUBTITLE_PATH,
      subtitles: [
        {
          uuid: 'sub-1',
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourceKey: SUBTITLE_KEY,
        },
      ],
    });

    await run(harness);

    expect(harness.downloadSubtitlesIfNecessary).not.toHaveBeenCalled();
  });
});
