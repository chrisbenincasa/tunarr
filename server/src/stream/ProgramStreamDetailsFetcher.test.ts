import { faker } from '@faker-js/faker';
import axios from 'axios';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import type { ProgramWithRelationsOrm } from '../db/schema/derivedTypes.ts';
import type {
  ArtworkResult,
  ArtworkService,
} from '../services/ArtworkService.ts';
import { fileExists } from '../util/fsUtil.ts';
import { ProgramStreamDetailsFetcher } from './ProgramStreamDetailsFetcher.ts';
import { FileStreamSource, HttpStreamSource } from './types.ts';

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

vi.mock('../util/fsUtil.ts', () => ({
  fileExists: vi.fn().mockResolvedValue(false),
}));

vi.mock('../util/serverUtil.ts', () => ({
  makeLocalUrl: (path: string) => `http://localhost:8000${path}`,
}));

vi.mock('axios', () => ({
  default: { head: vi.fn() },
}));

vi.mock('./PathCalculator.ts', () => ({
  PathCalculator: {
    findFirstValidPath: vi.fn().mockResolvedValue(undefined),
  },
}));

function makeServer(
  overrides: Partial<MediaSourceWithRelations> & { type: string; uri: string },
): MediaSourceWithRelations {
  return {
    uuid: faker.string.uuid(),
    accessToken: faker.string.alphanumeric(20),
    name: faker.company.name(),
    index: 0,
    createdAt: null,
    updatedAt: null,
    clientIdentifier: null,
    sendChannelUpdates: false,
    sendGuideUpdates: false,
    username: null,
    userId: null,
    mediaType: null,
    libraries: [],
    paths: [],
    replacePaths: [],
    ...overrides,
  } as MediaSourceWithRelations;
}

function makeProgram(
  serverType: string,
  serverPath: string,
): ProgramWithRelationsOrm {
  const externalSourceId = faker.string.uuid();
  return {
    uuid: faker.string.uuid(),
    title: faker.lorem.words(3),
    duration: 3600000,
    type: 'episode' as const,
    sourceType: serverType,
    seasonNumber: 1,
    episodeNumber: 1,
    showTitle: faker.lorem.words(2),
    showIcon: null,
    albumName: null,
    artistName: null,
    summary: null,
    plexRatingKey: null,
    plexFilePath: null,
    rating: null,
    icon: null,
    year: null,
    date: null,
    order: null,
    channelUuid: null,
    fillerShowUuid: null,
    customShowUuid: null,
    mediaSourceId: externalSourceId,
    parentExternalKey: null,
    grandparentExternalKey: null,
    createdAt: null,
    updatedAt: null,
    originalAirDate: null,
    imdbId: null,
    versions: [
      {
        uuid: faker.string.uuid(),
        programUuid: faker.string.uuid(),
        mediaSourceId: externalSourceId,
        sourceType: serverType,
        duration: 3600000,
        width: 1920,
        height: 1080,
        displayAspectRatio: '16/9',
        sampleAspectRatio: null,
        frameRate: null,
        scanKind: null,
        videoCodec: null,
        audioCodec: null,
        videoProfile: null,
        chapters: [],
        externalKey: null,
        directStreamUrl: null,
        createdAt: null,
        updatedAt: null,
        mediaFiles: [
          {
            uuid: faker.string.uuid(),
            mediaVersionUuid: faker.string.uuid(),
            path: '/some/local/path/file.mkv',
            createdAt: null,
            updatedAt: null,
          },
        ],
        mediaStreams: [
          {
            uuid: faker.string.uuid(),
            mediaVersionUuid: faker.string.uuid(),
            streamKind: 'video',
            index: 0,
            codec: 'h264',
            default: true,
            forced: false,
            title: null,
            channels: null,
            language: null,
            bitsPerSample: null,
            profile: null,
            pixelFormat: 'yuv420p',
            colorRange: null,
            colorSpace: null,
            colorTransfer: null,
            colorPrimaries: null,
            createdAt: null,
            updatedAt: null,
          },
        ],
      },
    ],
    externalIds: [
      {
        uuid: faker.string.uuid(),
        sourceType: serverType,
        externalKey: faker.string.alphanumeric(10),
        externalFilePath: serverPath,
        externalSourceId,
        programUuid: faker.string.uuid(),
        directFilePath: null,
        parentExternalKey: null,
        grandparentExternalKey: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    subtitles: [],
    customShows: [],
    fillerShows: [],
  } as unknown as ProgramWithRelationsOrm;
}

function makeArtworkService(
  result: ArtworkResult = { kind: 'not-found' },
): ArtworkService {
  return {
    resolveArtwork: vi.fn().mockResolvedValue(result),
  } as unknown as ArtworkService;
}

function makeProgramDB(program: ProgramWithRelationsOrm): IProgramDB {
  return {
    getStreamProgramById: vi.fn().mockResolvedValue(program),
  } as unknown as IProgramDB;
}

describe('ProgramStreamDetailsFetcher', () => {
  describe('getStream constructs valid HTTP URLs for remote streams', () => {
    it('constructs a valid Plex stream URL preserving the http:// protocol', async () => {
      const serverPath = '/library/parts/1014/1222133011/file.avi';
      const program = makeProgram('plex', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'plex',
        uri: 'http://10.0.0.110:32400',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const streamSource = result.get().streamSource;
      expect(streamSource).toBeInstanceOf(HttpStreamSource);
      expect(streamSource.type).toBe('http');

      const url = (streamSource as HttpStreamSource).path;
      expect(url).toContain('http://');
      expect(url).not.toContain('\\');
      expect(url).toBe(
        `http://10.0.0.110:32400/library/parts/1014/1222133011/file.avi?X-Plex-Token=${server.accessToken}`,
      );
    });

    it('constructs a valid Jellyfin stream URL preserving the http:// protocol', async () => {
      const serverPath = 'abc123def456';
      const program = makeProgram('jellyfin', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'jellyfin',
        uri: 'http://192.168.1.100:8096',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const streamSource = result.get().streamSource;
      expect(streamSource).toBeInstanceOf(HttpStreamSource);

      const url = (streamSource as HttpStreamSource).path;
      expect(url).toContain('http://');
      expect(url).not.toContain('\\');
      expect(url).toBe(
        'http://192.168.1.100:8096/Videos/abc123def456/stream?static=true',
      );
    });

    it('constructs a valid Emby stream URL preserving the http:// protocol', async () => {
      const serverPath = 'xyz789';
      const program = makeProgram('emby', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'emby',
        uri: 'http://10.0.0.50:8096',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const streamSource = result.get().streamSource;
      expect(streamSource).toBeInstanceOf(HttpStreamSource);

      const url = (streamSource as HttpStreamSource).path;
      expect(url).toContain('http://');
      expect(url).not.toContain('\\');
      expect(url).toBe(
        `http://10.0.0.50:8096/Videos/xyz789/stream?X-Emby-Token=${server.accessToken}&static=true`,
      );
    });

    it('handles server URIs with trailing slashes', async () => {
      const serverPath = '/library/parts/1014/file.avi';
      const program = makeProgram('plex', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'plex',
        uri: 'http://10.0.0.110:32400/',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const url = (result.get().streamSource as HttpStreamSource).path;
      // Should not have double slashes between host and path
      expect(url).not.toMatch(/:\d+\/\//);
      expect(url).toContain('http://');
    });
  });

  describe('getStream constructs valid HTTP URLs on Windows (simulated)', () => {
    beforeEach(() => {
      vi.spyOn(path, 'join').mockImplementation((...args: string[]) =>
        path.win32.join(...args),
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('constructs a valid Plex stream URL on Windows without backslash mangling', async () => {
      const serverPath = '/library/parts/1014/1222133011/file.avi';
      const program = makeProgram('plex', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'plex',
        uri: 'http://10-0-0-110.abc123.plex.direct:32400',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const url = (result.get().streamSource as HttpStreamSource).path;
      expect(url).toContain('http://');
      expect(url).not.toContain('\\');
      expect(url).toBe(
        `http://10-0-0-110.abc123.plex.direct:32400/library/parts/1014/1222133011/file.avi?X-Plex-Token=${server.accessToken}`,
      );
    });

    it('constructs a valid Jellyfin stream URL on Windows without backslash mangling', async () => {
      const serverPath = 'abc123def456';
      const program = makeProgram('jellyfin', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'jellyfin',
        uri: 'http://192.168.1.100:8096',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const url = (result.get().streamSource as HttpStreamSource).path;
      expect(url).toContain('http://');
      expect(url).not.toContain('\\');
      expect(url).toBe(
        'http://192.168.1.100:8096/Videos/abc123def456/stream?static=true',
      );
    });

    it('constructs a valid Emby stream URL on Windows without backslash mangling', async () => {
      const serverPath = 'xyz789';
      const program = makeProgram('emby', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = new ProgramStreamDetailsFetcher(
        programDB,
        makeArtworkService(),
      );

      const server = makeServer({
        type: 'emby',
        uri: 'http://10.0.0.50:8096',
      });

      const result = await fetcher.getStream({
        server,
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.isSuccess()).toBe(true);

      const url = (result.get().streamSource as HttpStreamSource).path;
      expect(url).toContain('http://');
      expect(url).not.toContain('\\');
      expect(url).toBe(
        `http://10.0.0.50:8096/Videos/xyz789/stream?X-Emby-Token=${server.accessToken}&static=true`,
      );
    });
  });

  describe('getStream picks a placeholder image for audio-only programs', () => {
    const GenericMusicScreen =
      'http://localhost:8000/images/generic-music-screen.png';

    function makeAudioOnlyProgram(): ProgramWithRelationsOrm {
      const program = makeProgram('local', '');
      const version = program.versions[0];
      if (!version) {
        throw new Error('makeProgram always creates a version');
      }
      const videoStream = version.mediaStreams?.[0];
      if (!videoStream) {
        throw new Error('makeProgram always creates a video stream');
      }
      version.mediaStreams = [
        {
          ...videoStream,
          streamKind: 'audio',
          codec: 'flac',
          channels: 2,
          pixelFormat: null,
        },
      ];
      return program;
    }

    async function getStreamDetails(artworkService: ArtworkService) {
      const program = makeAudioOnlyProgram();
      const fetcher = new ProgramStreamDetailsFetcher(
        makeProgramDB(program),
        artworkService,
      );
      const result = await fetcher.getStream({
        server: makeServer({ type: 'local', uri: '' }),
        lineupItem: program.externalIds[0] as any,
      });
      expect(result.isSuccess()).toBe(true);
      return result.get().streamDetails;
    }

    afterEach(() => {
      vi.mocked(fileExists).mockReset().mockResolvedValue(false);
      vi.mocked(axios.head).mockReset();
    });

    it('uses cached artwork on disk', async () => {
      vi.mocked(fileExists).mockResolvedValueOnce(true);

      const details = await getStreamDetails(
        makeArtworkService({
          kind: 'file',
          path: '/cache/album.jpg',
          artworkType: 'poster',
        }),
      );

      expect(details.audioOnly).toBe(true);
      expect(details.placeholderImage).toEqual(
        new FileStreamSource('/cache/album.jpg'),
      );
    });

    it('uses reachable remote artwork and keeps its auth headers', async () => {
      vi.mocked(axios.head).mockResolvedValueOnce({ status: 200 });
      const headers = { 'X-Plex-Token': 'token' };

      const details = await getStreamDetails(
        makeArtworkService({
          kind: 'url',
          url: 'http://plex:32400/library/metadata/1/thumb',
          headers,
        }),
      );

      expect(details.placeholderImage).toEqual(
        new HttpStreamSource(
          'http://plex:32400/library/metadata/1/thumb',
          headers,
        ),
      );
    });

    it('falls back to the generic music screen when remote artwork is unreachable', async () => {
      vi.mocked(axios.head).mockRejectedValueOnce(new Error('404'));

      const details = await getStreamDetails(
        makeArtworkService({
          kind: 'url',
          url: 'http://plex:32400/library/metadata/1/thumb',
        }),
      );

      expect(details.placeholderImage?.path).toBe(GenericMusicScreen);
    });

    it('falls back to the generic music screen when cached artwork is missing', async () => {
      const details = await getStreamDetails(
        makeArtworkService({
          kind: 'file',
          path: '/cache/missing.jpg',
          artworkType: 'poster',
        }),
      );

      expect(details.placeholderImage?.path).toBe(GenericMusicScreen);
    });

    it('falls back to the generic music screen when cached artwork is unreadable', async () => {
      vi.mocked(fileExists).mockRejectedValueOnce(
        Object.assign(new Error('permission denied'), { code: 'EACCES' }),
      );

      const details = await getStreamDetails(
        makeArtworkService({
          kind: 'file',
          path: '/cache/poster.jpg',
          artworkType: 'poster',
        }),
      );

      expect(details.placeholderImage?.path).toBe(GenericMusicScreen);
    });

    it('falls back to the generic music screen when there is no artwork', async () => {
      const details = await getStreamDetails(makeArtworkService());

      expect(details.placeholderImage?.path).toBe(GenericMusicScreen);
    });

    it('falls back to the generic music screen when artwork lookup throws', async () => {
      const artworkService = {
        resolveArtwork: vi.fn().mockRejectedValue(new Error('db is gone')),
      } as unknown as ArtworkService;

      const details = await getStreamDetails(artworkService);

      expect(details.placeholderImage?.path).toBe(GenericMusicScreen);
    });

    it('does not look up artwork for programs with video', async () => {
      const program = makeProgram('local', '');
      const artworkService = makeArtworkService();
      const fetcher = new ProgramStreamDetailsFetcher(
        makeProgramDB(program),
        artworkService,
      );

      const result = await fetcher.getStream({
        server: makeServer({ type: 'local', uri: '' }),
        lineupItem: program.externalIds[0] as any,
      });

      expect(result.get().streamDetails.placeholderImage).toBeUndefined();
      expect(artworkService.resolveArtwork).not.toHaveBeenCalled();
    });
  });
});
