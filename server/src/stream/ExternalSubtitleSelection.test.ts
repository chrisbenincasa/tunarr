import { faker } from '@faker-js/faker';
import type { StreamSelectionProfile } from '@tunarr/types/schemas';
import type { NonEmptyArray } from 'ts-essentials';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ContentBackedStreamLineupItem,
  StreamLineupProgram,
} from '../db/derived_types/StreamLineup.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import { evaluateStreamSelectionProfile } from '../ffmpeg/StreamSelectionEvaluator.ts';
import type {
  CelEvaluationService,
  StreamSelectionCelContext,
} from '../services/CelEvaluationService.ts';
import { ProgramStreamDetailsFetcher } from './ProgramStreamDetailsFetcher.ts';
import type { AudioStreamDetails, SubtitleStreamDetails } from './types.ts';

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

vi.mock('../globals.ts', () => ({
  globalOptions: () => ({ databaseDirectory: '/tmp/test-tunarr' }),
}));

// Shared by ProgramStreamDetailsFetcher (sidecar existence checks) and
// SubtitleStreamPicker (extracted-subtitle cache lookups).
const mockFileExists = vi.fn<(p: string) => Promise<boolean>>();
vi.mock('../util/fsUtil.ts', () => ({
  fileExists: (p: string) => mockFileExists(p),
}));

const SERVER_URI = 'http://192.168.1.100:8096';

type MediaStreamRow = {
  streamKind: string;
  index: number;
  codec: string;
  default?: boolean;
  forced?: boolean;
  language?: string | null;
};

type SubtitleRow = {
  subtitleType: 'embedded' | 'sidecar';
  codec: string;
  language: string;
  /** A path Tunarr can open directly. */
  path?: string | null;
  /** Where the media source says the file lives, in its own namespace. */
  sourcePath?: string | null;
  /** The source-relative route that serves the file over HTTP. */
  sourceKey?: string | null;
  streamIndex?: number | null;
  default?: boolean;
  forced?: boolean;
  sdh?: boolean;
  isExtracted?: boolean;
};

function makeMediaStream(stream: MediaStreamRow) {
  return {
    uuid: faker.string.uuid(),
    mediaVersionUuid: faker.string.uuid(),
    title: null,
    channels: null,
    bitsPerSample: null,
    profile: null,
    pixelFormat: null,
    colorRange: null,
    colorSpace: null,
    colorTransfer: null,
    colorPrimaries: null,
    createdAt: null,
    updatedAt: null,
    default: false,
    forced: false,
    language: null,
    ...stream,
  };
}

function makeProgram(
  mediaStreams: MediaStreamRow[],
  subtitles: SubtitleRow[],
): StreamLineupProgram {
  const externalSourceId = faker.string.uuid();
  const programId = faker.string.uuid();
  return {
    uuid: programId,
    title: faker.lorem.words(3),
    duration: 3600000,
    type: 'movie' as const,
    sourceType: 'jellyfin',
    mediaSourceId: externalSourceId,
    createdAt: null,
    updatedAt: null,
    versions: [
      {
        uuid: faker.string.uuid(),
        programUuid: programId,
        mediaSourceId: externalSourceId,
        sourceType: 'jellyfin',
        duration: 3600000,
        width: 1920,
        height: 1080,
        displayAspectRatio: '16/9',
        sampleAspectRatio: null,
        frameRate: null,
        scanKind: null,
        chapters: [],
        externalKey: null,
        directStreamUrl: null,
        createdAt: null,
        updatedAt: null,
        mediaFiles: [
          {
            uuid: faker.string.uuid(),
            mediaVersionUuid: faker.string.uuid(),
            path: '/media/movie.mkv',
            createdAt: null,
            updatedAt: null,
          },
        ],
        mediaStreams: mediaStreams.map(makeMediaStream),
      },
    ],
    // One per source type so the same program can be resolved against a
    // Jellyfin, Emby or Plex server without reshaping the fixture.
    externalIds: (['jellyfin', 'emby', 'plex'] as const).map((sourceType) => ({
      uuid: faker.string.uuid(),
      sourceType,
      externalKey: 'jf-item-1',
      externalFilePath: 'jf-item-1',
      externalSourceId,
      programUuid: programId,
      directFilePath: null,
      createdAt: null,
      updatedAt: null,
    })),
    subtitles: subtitles.map((sub) => ({
      uuid: faker.string.uuid(),
      programId,
      createdAt: null,
      updatedAt: null,
      default: false,
      forced: false,
      sdh: false,
      isExtracted: false,
      path: null,
      sourcePath: null,
      sourceKey: null,
      streamIndex: null,
      ...sub,
    })),
    customShows: [],
    fillerShows: [],
  } as unknown as StreamLineupProgram;
}

function makeServer(
  type: 'jellyfin' | 'emby' | 'plex' = 'jellyfin',
  replacePaths: { serverPath: string; localPath: string }[] = [],
): MediaSourceWithRelations {
  return {
    uuid: faker.string.uuid(),
    accessToken: 'token',
    name: type,
    type,
    uri: SERVER_URI,
    index: 0,
    libraries: [],
    paths: [],
    replacePaths,
  } as unknown as MediaSourceWithRelations;
}

function makeLineupItem(program: StreamLineupProgram) {
  return {
    type: 'program',
    uuid: program.uuid,
    program: {
      uuid: program.uuid,
      title: program.title,
      type: program.type,
      externalKey: 'jf-item-1',
      mediaSourceId: program.mediaSourceId,
      sourceType: 'jellyfin',
    },
  } as unknown as ContentBackedStreamLineupItem;
}

function makeProgramDB(program: StreamLineupProgram): IProgramDB {
  return {
    getProgramById: vi.fn().mockResolvedValue(program),
    clearExtractedSubtitle: vi.fn().mockResolvedValue(undefined),
  } as unknown as IProgramDB;
}

const celService = {
  evaluate: vi.fn().mockReturnValue(true),
  validate: vi.fn().mockReturnValue(undefined),
};

function makeProfile(
  subtitleAction: StreamSelectionProfile['rules'][number]['subtitleAction'],
): StreamSelectionProfile {
  return {
    uuid: 'profile-1',
    name: 'Test',
    rules: [
      {
        label: 'Always',
        condition: 'true',
        audioAction: { type: 'default' },
        subtitleAction,
      },
    ],
  };
}

const audioStreams: NonEmptyArray<AudioStreamDetails> = [
  {
    index: 1,
    codec: 'aac',
    channels: 2,
    default: true,
    languageCodeISO6392: 'eng',
  },
];

async function select(
  subtitleStreams: SubtitleStreamDetails[],
  action: StreamSelectionProfile['rules'][number]['subtitleAction'],
  lineupItem: ContentBackedStreamLineupItem,
) {
  return await evaluateStreamSelectionProfile(
    makeProfile(action),
    audioStreams,
    subtitleStreams,
    celService as unknown as CelEvaluationService,
    {} as StreamSelectionCelContext,
    lineupItem,
  );
}

// A Jellyfin/Emby item with a text-based external subtitle. The scanner records
// it twice: once as an `external_subtitles` media stream row (that table has no
// path column, and the index it stores is container-relative, so the row is not
// addressable on its own) and once as a `sidecar` program_subtitles row holding
// the locations the subtitle can be reached at.
const JELLYFIN_SUBTITLE_PATH =
  '/Videos/jf-item-1/jf-item-1/Subtitles/2/Stream.srt';
const SOURCE_SUBTITLE_PATH = '/data/media/movie.eng.srt';
const CACHED_SUBTITLE_PATH = '/tmp/test-tunarr/cache/subtitles/ab/cd/abcd.srt';

const remoteExternalSubMediaStreams: MediaStreamRow[] = [
  { streamKind: 'video', index: 0, codec: 'h264' },
  { streamKind: 'audio', index: 1, codec: 'aac', language: 'eng' },
  {
    streamKind: 'external_subtitles',
    index: 2,
    codec: 'subrip',
    language: 'eng',
    default: true,
  },
];

// What a scan leaves behind: the subtitle downloaded into Tunarr's cache, with
// both source locations kept so a later scan can re-resolve it.
const remoteExternalSubRows: SubtitleRow[] = [
  {
    subtitleType: 'sidecar',
    codec: 'subrip',
    language: 'eng',
    path: CACHED_SUBTITLE_PATH,
    sourcePath: SOURCE_SUBTITLE_PATH,
    sourceKey: JELLYFIN_SUBTITLE_PATH,
    streamIndex: null,
    default: true,
  },
];

function makeFetcher(program: StreamLineupProgram) {
  return new ProgramStreamDetailsFetcher(makeProgramDB(program));
}

async function detailsFor(program: StreamLineupProgram, server = makeServer()) {
  const result = await makeFetcher(program).getStream({
    server,
    lineupItem: program,
  });
  expect(result.isSuccess()).toBe(true);
  return result.get().streamDetails;
}

describe('external subtitles end-to-end (fetcher -> stream selector)', () => {
  beforeEach(() => {
    mockFileExists.mockReset();
    mockFileExists.mockImplementation((p: string) =>
      Promise.resolve(p === CACHED_SUBTITLE_PATH),
    );
    celService.evaluate.mockClear();
  });

  it('surfaces the external subtitle exactly once', async () => {
    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, remoteExternalSubRows),
    );

    expect(details.subtitleDetails).toHaveLength(1);
  });

  it('hands ffmpeg the cached copy downloaded during scanning', async () => {
    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, remoteExternalSubRows),
    );

    const [subtitle] = details.subtitleDetails ?? [];
    expect(subtitle?.type).toBe('external');
    expect(subtitle?.path).toBe(CACHED_SUBTITLE_PATH);
  });

  it('selects the external subtitle with a by_language action', async () => {
    const program = makeProgram(
      remoteExternalSubMediaStreams,
      remoteExternalSubRows,
    );
    const details = await detailsFor(program);

    const { subtitleStream } = await select(
      details.subtitleDetails ?? [],
      {
        type: 'by_language',
        languages: ['eng'],
        filterType: 'any',
        allowImageBased: true,
        allowExternal: true,
      },
      makeLineupItem(program),
    );

    expect(subtitleStream?.path).toBe(CACHED_SUBTITLE_PATH);
  });

  it('selects the external subtitle with a default action', async () => {
    const program = makeProgram(
      remoteExternalSubMediaStreams,
      remoteExternalSubRows,
    );
    const details = await detailsFor(program);

    const { subtitleStream } = await select(
      details.subtitleDetails ?? [],
      { type: 'default' },
      makeLineupItem(program),
    );

    expect(subtitleStream?.path).toBe(CACHED_SUBTITLE_PATH);
  });

  it('does not select an external subtitle when allowExternal is false', async () => {
    const program = makeProgram(remoteExternalSubMediaStreams, [
      {
        subtitleType: 'sidecar',
        codec: 'subrip',
        language: 'eng',
        sourceKey: JELLYFIN_SUBTITLE_PATH,
        default: true,
      },
    ]);
    const details = await detailsFor(program);

    const { subtitleStream } = await select(
      details.subtitleDetails ?? [],
      {
        type: 'by_language',
        languages: ['eng'],
        filterType: 'any',
        allowImageBased: true,
        allowExternal: false,
      },
      makeLineupItem(program),
    );

    expect(subtitleStream).toBeNull();
  });

  it('prefers the file on disk when the sidecar was downloaded locally', async () => {
    const sidecarPath = '/media/movie.eng.srt';
    mockFileExists.mockImplementation((p: string) =>
      Promise.resolve(p === sidecarPath),
    );

    const program = makeProgram(remoteExternalSubMediaStreams, [
      {
        subtitleType: 'sidecar',
        codec: 'subrip',
        language: 'eng',
        path: sidecarPath,
        streamIndex: null,
        default: true,
      },
    ]);
    const details = await detailsFor(program);

    const { subtitleStream } = await select(
      details.subtitleDetails ?? [],
      { type: 'default' },
      makeLineupItem(program),
    );

    expect(subtitleStream?.path).toBe(sidecarPath);
  });

  it('drops a sidecar subtitle with no recorded location', async () => {
    mockFileExists.mockResolvedValue(false);

    // Databases scanned before external subtitle locations were recorded. The
    // subtitle comes back on the next library refresh; until then there is
    // nothing to hand ffmpeg.
    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, [
        {
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          default: true,
        },
      ]),
    );

    expect(details.subtitleDetails).toBeUndefined();
  });

  it('drops a sidecar whose source path is not visible to Tunarr', async () => {
    mockFileExists.mockResolvedValue(false);

    // The media source can see this file; Tunarr cannot, and no replacement
    // maps it. Without a route there is nothing left to try.
    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, [
        {
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourcePath: '/data/media/movie.eng.srt',
          default: true,
        },
      ]),
    );

    expect(details.subtitleDetails).toBeUndefined();
  });

  it('falls back to shared storage when there is no downloaded copy', async () => {
    const sharedPath = '/data/media/movie.eng.srt';
    mockFileExists.mockImplementation((p: string) =>
      Promise.resolve(p === sharedPath),
    );

    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, [
        {
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourcePath: sharedPath,
          sourceKey: JELLYFIN_SUBTITLE_PATH,
          default: true,
        },
      ]),
    );

    expect(details.subtitleDetails?.[0]?.path).toBe(sharedPath);
  });

  it('applies the media source path replacements to a shared sidecar', async () => {
    const localPath = '/mnt/media/movie.eng.srt';
    mockFileExists.mockImplementation((p: string) =>
      Promise.resolve(p === localPath),
    );

    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, [
        {
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourcePath: '/data/media/movie.eng.srt',
          sourceKey: JELLYFIN_SUBTITLE_PATH,
          default: true,
        },
      ]),
      makeServer('jellyfin', [
        { serverPath: '/data/media', localPath: '/mnt/media' },
      ]),
    );

    expect(details.subtitleDetails?.[0]?.path).toBe(localPath);
  });

  it('drops a sidecar that has a source route but no local copy yet', async () => {
    // Nothing is streamed from the media source at playback time: if the scan
    // could not put a copy on disk, the subtitle waits for the next scan.
    mockFileExists.mockResolvedValue(false);

    const details = await detailsFor(
      makeProgram(remoteExternalSubMediaStreams, [
        {
          subtitleType: 'sidecar',
          codec: 'subrip',
          language: 'eng',
          sourcePath: SOURCE_SUBTITLE_PATH,
          sourceKey: JELLYFIN_SUBTITLE_PATH,
          default: true,
        },
      ]),
    );

    expect(details.subtitleDetails).toBeUndefined();
  });

  it('does not surface embedded subtitles that have not been extracted', async () => {
    const details = await detailsFor(
      makeProgram(
        [
          { streamKind: 'video', index: 0, codec: 'h264' },
          { streamKind: 'audio', index: 1, codec: 'aac', language: 'eng' },
          {
            streamKind: 'subtitles',
            index: 2,
            codec: 'subrip',
            language: 'eng',
            default: true,
          },
        ],
        [
          {
            subtitleType: 'embedded',
            codec: 'subrip',
            language: 'eng',
            streamIndex: 2,
            default: true,
          },
        ],
      ),
    );

    // Only the container stream, described as embedded at its real index.
    expect(details.subtitleDetails).toHaveLength(1);
    expect(details.subtitleDetails?.[0]?.type).toBe('embedded');
    expect(details.subtitleDetails?.[0]?.index).toBe(2);
  });
});
