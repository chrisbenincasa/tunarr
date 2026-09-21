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

  describe('deleteOldSegments', () => {
    let dir: tmp.DirResult;

    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
    });

    afterEach(() => {
      dir.removeCallback();
    });

    async function pruneBelow(sequence: number, files: string[]) {
      const session = makeSession(dir.name);
      await fs.mkdir(session.workingDirectory, { recursive: true });
      await Promise.all(
        files.map((f) =>
          fs.writeFile(path.join(session.workingDirectory, f), ''),
        ),
      );

      await (
        session as unknown as {
          deleteOldSegments(sequence: number): Promise<void>;
        }
      ).deleteOldSegments(sequence);

      return (await fs.readdir(session.workingDirectory)).sort();
    }

    test('deletes media segments below the playlist sequence', async () => {
      await expect(
        pruneBelow(3, [
          'data000001.ts',
          'data000002.ts',
          'data000003.ts',
          'data000004.ts',
        ]),
      ).resolves.toEqual(['data000003.ts', 'data000004.ts']);
    });

    test('deletes fmp4 segments too', async () => {
      await expect(
        pruneBelow(2, ['data000001.mp4', 'data000002.mp4']),
      ).resolves.toEqual(['data000002.mp4']);
    });

    // The subtitle output segments on its own cadence and restarts its counter
    // every program, so the video sequence would delete live captions.
    test('leaves WebVTT segments alone', async () => {
      await expect(
        pruneBelow(500, ['sub000001.vtt', 'sub000002.vtt', 'data000001.ts']),
      ).resolves.toEqual(['sub000001.vtt', 'sub000002.vtt']);
    });

    test('leaves playlists alone', async () => {
      await expect(
        pruneBelow(500, ['stream.m3u8', 'playlist.m3u8', 'subs.m3u8']),
      ).resolves.toEqual(['playlist.m3u8', 'stream.m3u8', 'subs.m3u8']);
    });
  });
});
