import { describe, expect, it } from 'vitest';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
import {
  HlsOutputFormat,
  defaultHlsOptions,
} from '../ffmpeg/builder/constants.ts';
import type { FFmpegAssistedFactory } from '../ffmpeg/FFmpegModule.ts';
import type { TranscodeSessionResult } from '../ffmpeg/types.ts';
import type { CacheImageService } from '../services/cacheImageService.ts';
import type { Result } from '../types/result.ts';
import type { PlayerContext } from './PlayerStreamContext.ts';
import { ProgramStream } from './ProgramStream.ts';
import type { ProgramStreamDetailsFetcher } from './ProgramStreamDetailsFetcher.ts';

class ThrowingProgramStream extends ProgramStream {
  protected override setupInternal(): Promise<Result<TranscodeSessionResult>> {
    return Promise.reject(
      new Error('Streams with no video are not currently supported.'),
    );
  }
}

describe('ProgramStream', () => {
  it('turns a setup throw into a failed result', async () => {
    const stream = new ThrowingProgramStream(
      {} as ISettingsDB,
      {} as CacheImageService,
      {} as FFmpegAssistedFactory,
      {} as MediaSourceDB,
      {} as ProgramStreamDetailsFetcher,
      [],
      {} as PlayerContext,
      HlsOutputFormat(defaultHlsOptions),
    );

    const result = await stream.setup();

    expect(result.isFailure()).toBe(true);
    expect(stream.isInitialized()).toBe(false);
  });
});
