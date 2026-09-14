import { faker } from '@faker-js/faker';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import type { ProgramWithRelationsOrm } from '../db/schema/derivedTypes.ts';
import { ProgramStreamDetailsFetcher } from './ProgramStreamDetailsFetcher.ts';
import { HttpStreamSource } from './types.ts';

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

function makeProgramDB(program: ProgramWithRelationsOrm): IProgramDB {
  return {
    getProgramById: vi.fn().mockResolvedValue(program),
  } as unknown as IProgramDB;
}

function makeSettingsDB(
  streamPath: 'direct' | 'plex' = 'plex',
): ISettingsDB {
  return {
    plexSettings: () => ({ streamPath }),
  } as unknown as ISettingsDB;
}

function makeFetcher(
  program: ProgramWithRelationsOrm,
  streamPath: 'direct' | 'plex' = 'plex',
) {
  return new ProgramStreamDetailsFetcher(
    makeProgramDB(program),
    makeSettingsDB(streamPath),
  );
}

describe('ProgramStreamDetailsFetcher', () => {
  describe('getStream constructs valid HTTP URLs for remote streams', () => {
    it('constructs a valid Plex stream URL preserving the http:// protocol', async () => {
      const serverPath = '/library/parts/1014/1222133011/file.avi';
      const program = makeProgram('plex', serverPath);
      const programDB = makeProgramDB(program);
      const fetcher = makeFetcher(program);

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
      const fetcher = makeFetcher(program);

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
      const fetcher = makeFetcher(program);

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
      const fetcher = makeFetcher(program);

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
      const fetcher = makeFetcher(program);

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
      const fetcher = makeFetcher(program);

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
      const fetcher = makeFetcher(program);

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
});
