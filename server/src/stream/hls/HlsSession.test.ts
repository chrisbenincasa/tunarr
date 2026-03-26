import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import type { ProgramStream } from '@/stream/ProgramStream.js';
import type { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import type { PlayerContext } from '@/stream/PlayerStreamContext.js';
import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import tmp from 'tmp';
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

vi.mock('@/stream/ConnectionTracker.js', () => ({
  ConnectionTracker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    recordHeartbeat: vi.fn(),
    removeStaleConnections: vi.fn(() => []),
  })),
}));

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
});
