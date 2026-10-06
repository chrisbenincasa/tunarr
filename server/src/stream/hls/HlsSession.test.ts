import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import type { PlayerContext } from '@/stream/PlayerStreamContext.js';
import type { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ProgramStream } from '../ProgramStream.ts';
import { HlsSession } from './HlsSession.js';

vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: {
    child: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock('@/stream/ConnectionTracker.ts', () => {
  return {
    ConnectionTracker: class {
      on = vi.fn();
      recordHeartbeat = vi.fn();
      removeStaleConnections = vi.fn(() => []);
    },
  };
});

const channelUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeSession(transcodeDirectory: string): HlsSession {
  const channel = {
    uuid: channelUuid,
    transcodeConfig: {},
  } as ChannelOrmWithTranscodeConfig;

  const options = {
    streamMode: 'hls' as const,
    initialSegmentCount: 2,
    transcodeDirectory,
  };

  return new HlsSession(
    channel,
    options,
    {} as StreamProgramCalculator,
    {} as ISettingsDB,
    {} as OnDemandChannelService,
    (() => ({}) as unknown as ProgramStream) as (
      ctx: PlayerContext,
      fmt: OutputFormat,
    ) => ProgramStream,
  );
}
describe('HlsSession', () => {
  describe('getMasterPlaylist', () => {
    let dir: tmp.DirResult;

    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
    });

    afterEach(() => {
      dir.removeCallback();
    });

    test('returns undefined when playlist.m3u8 does not exist', async () => {
      // Working directory will be created by initDirectories, but we skip that here.
      // The file simply won't exist.
      const session = makeSession(dir.name);
      const result = await session.getMasterPlaylist();
      expect(result.isSuccess()).toBe(true);
      expect(result.get()).toBeUndefined();
    });
  });

  describe('trimSubtitlePlaylist', () => {
    let dir: tmp.DirResult;

    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
    });

    afterEach(() => {
      dir.removeCallback();
    });

    test('returns undefined when subs.m3u8 does not exist', async () => {
      const session = makeSession(dir.name);
      const result = await session.trimSubtitlePlaylist();
      expect(result.isSuccess()).toBe(true);
      expect(result.get()).toBeUndefined();
    });

    test('derives a non-zero media sequence from segment file numbers on disk', async () => {
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });

      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
      ];
      for (let i = 20; i < 25; i++) {
        lines.push('#EXTINF:4.000000,', `sub${String(i).padStart(6, '0')}.vtt`);
      }
      await fs.writeFile(path.join(workingDir, 'subs.m3u8'), lines.join('\n'));

      const result = await session.trimSubtitlePlaylist();
      expect(result.isSuccess()).toBe(true);
      const trimResult = result.get();
      expect(trimResult).toBeDefined();
      expect(trimResult!.sequence).toBe(20);
      expect(trimResult!.playlist).toContain('#EXT-X-MEDIA-SEQUENCE:20');
    });

    test('a client that has only ever requested an old video segment does not drag down the subtitle floor', async () => {
      // Regression test for the "media sequence changed unexpectedly: 24 ->
      // 13" bug: before BaseHlsSession tracked video/subtitle segment
      // numbers independently, the default trim floor
      // (`minSegmentRequested`) was a single per-IP value shared across
      // both numbering spaces. A client that connected but has so far only
      // fetched an old, low-numbered video segment would report that low
      // number as its "last requested segment" — which then incorrectly
      // became part of the *subtitle* trim's floor too, even though it has
      // nothing to do with subtitle segment numbers, dragging the reported
      // sequence back down on the next poll.
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });

      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
      ];
      for (let i = 0; i < 60; i++) {
        lines.push('#EXTINF:4.000000,', `sub${String(i).padStart(6, '0')}.vtt`);
      }
      await fs.writeFile(path.join(workingDir, 'subs.m3u8'), lines.join('\n'));

      // Client A has been following subtitles and is caught up.
      session.onSegmentRequested('192.168.1.1', 'sub000050.vtt');
      // Client B is lagging behind on video and hasn't touched subtitles.
      session.onSegmentRequested('192.168.1.2', 'data000015.ts');

      const result = await session.trimSubtitlePlaylist();
      expect(result.isSuccess()).toBe(true);
      const trimResult = result.get();
      expect(trimResult).toBeDefined();
      // Floor should come from client A's subtitle position (50), not
      // client B's unrelated low video number (15).
      expect(trimResult!.sequence).toBe(40);
    });

    test('never lists segments below what pruning already deleted', async () => {
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });

      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
      ];
      for (let i = 0; i < 60; i++) {
        lines.push('#EXTINF:4.000000,', `sub${String(i).padStart(6, '0')}.vtt`);
      }
      await fs.writeFile(path.join(workingDir, 'subs.m3u8'), lines.join('\n'));

      // This trim deletes everything below 40.
      session.onSegmentRequested('192.168.1.1', 'sub000050.vtt');
      const first = await session.trimSubtitlePlaylist();
      expect(first.get()?.sequence).toBe(40);

      // The client rewinds past the deleted range.
      session.onSegmentRequested('192.168.1.1', 'sub000020.vtt');
      const second = await session.trimSubtitlePlaylist();
      expect(second.get()?.sequence).toBe(40);
      expect(second.get()?.playlist).not.toContain('sub000039.vtt');
    });
  });

  describe('getLastSubtitleSegmentNumber (private)', () => {
    let dir: tmp.DirResult;

    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
    });

    afterEach(() => {
      dir.removeCallback();
    });

    test('returns 0 when no .vtt segments exist', async () => {
      const session = makeSession(dir.name);
      await fs.mkdir(session.workingDirectory, { recursive: true });

      const result = await (
        session as unknown as {
          getLastSubtitleSegmentNumber(): Promise<number>;
        }
      ).getLastSubtitleSegmentNumber();

      expect(result).toBe(0);
    });

    test('returns one past the highest existing .vtt segment number', async () => {
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });
      for (const n of [0, 1, 2, 3, 4]) {
        await fs.writeFile(
          path.join(workingDir, `sub${String(n).padStart(6, '0')}.vtt`),
          'WEBVTT\n',
        );
      }

      const result = await (
        session as unknown as {
          getLastSubtitleSegmentNumber(): Promise<number>;
        }
      ).getLastSubtitleSegmentNumber();

      expect(result).toBe(5);
    });
  });

  describe('deleteOldSegmentFiles (private)', () => {
    let dir: tmp.DirResult;

    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
    });

    afterEach(() => {
      dir.removeCallback();
    });

    async function callDeleteOldSegmentFiles(
      session: HlsSession,
      sequenceNum: number,
      extensions: string[],
    ) {
      return (
        session as unknown as {
          deleteOldSegmentFiles(
            sequenceNum: number,
            extensions: string[],
          ): Promise<void>;
        }
      ).deleteOldSegmentFiles(sequenceNum, extensions);
    }

    test('deletes .ts/.mp4 segments below the sequence number (regression)', async () => {
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });
      for (const n of [0, 1, 2, 3, 4]) {
        await fs.writeFile(
          path.join(workingDir, `data${String(n).padStart(6, '0')}.ts`),
          '',
        );
      }

      await callDeleteOldSegmentFiles(session, 3, ['.ts', '.mp4']);

      const remaining = await fs.readdir(workingDir);
      expect(remaining.sort()).toEqual(['data000003.ts', 'data000004.ts']);
    });

    test('deletes .vtt segments below the sequence number', async () => {
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });
      for (const n of [0, 1, 2, 3, 4]) {
        await fs.writeFile(
          path.join(workingDir, `sub${String(n).padStart(6, '0')}.vtt`),
          'WEBVTT\n',
        );
      }

      await callDeleteOldSegmentFiles(session, 3, ['.vtt']);

      const remaining = await fs.readdir(workingDir);
      expect(remaining.sort()).toEqual(['sub000003.vtt', 'sub000004.vtt']);
    });

    test('extensions filter is respected — .vtt deletion leaves .ts files untouched', async () => {
      const session = makeSession(dir.name);
      const workingDir = session.workingDirectory;
      await fs.mkdir(workingDir, { recursive: true });
      await fs.writeFile(path.join(workingDir, 'data000000.ts'), '');
      await fs.writeFile(path.join(workingDir, 'sub000000.vtt'), 'WEBVTT\n');

      await callDeleteOldSegmentFiles(session, 5, ['.vtt']);

      const remaining = await fs.readdir(workingDir);
      expect(remaining.sort()).toEqual(['data000000.ts']);
    });
  });
});
