import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { FFmpegAssistedFactory } from '@/ffmpeg/FFmpegModule.js';
import type { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import tmp from 'tmp';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ProgramStreamFactory } from '../ProgramStreamFactory.ts';
import { HlsSlowerSession } from './HlsSlowerSession.ts';

vi.mock('@/util/serverUtil.js', () => ({
  makeFfmpegPlaylistUrl: () => 'http://localhost/ffmpeg/playlist',
}));

describe('HlsSlowerSession', () => {
  let tmpDir: tmp.DirResult;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  test('reports the transcode running only while the concat ffmpeg runs', async () => {
    const process = { running: true };
    const concatSession = { on: vi.fn(), start: vi.fn(), process };
    const ffmpegFactory = (() => ({
      createConcatSession: vi.fn(() => Promise.resolve(concatSession)),
    })) as unknown as FFmpegAssistedFactory;

    const session = new HlsSlowerSession(
      {
        uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        transcodeConfig: {},
      } as ChannelOrmWithTranscodeConfig,
      { initialSegmentCount: 2, transcodeDirectory: tmpDir.name },
      {} as StreamProgramCalculator,
      (() => ({})) as unknown as ProgramStreamFactory,
      ffmpegFactory,
    );
    const internals = session as unknown as {
      startInternal(): Promise<void>;
      isTranscodeRunning(): boolean;
    };

    expect(internals.isTranscodeRunning()).toBe(false);

    await internals.startInternal();
    expect(internals.isTranscodeRunning()).toBe(true);

    process.running = false;
    expect(internals.isTranscodeRunning()).toBe(false);
  });
});
