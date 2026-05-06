import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { StreamOptions } from '../ffmpeg/ffmpegBase.ts';
import type { PlayerContext } from './PlayerStreamContext.js';
import type { ProgramStream } from './ProgramStream2.ts';
import type { ProgramStreamOld } from './ProgramStreamOld.ts';

/**
 * Creates a {@link ProgramStreamOld} baased on the given context
 */
export type ProgramStreamFactoryOld = (
  context: PlayerContext,
  outputFormat: OutputFormat,
) => ProgramStreamOld;

export type ProgramStreamFactory = (
  context: PlayerContext,
  outputFormat: OutputFormat,
  opts?: Partial<StreamOptions>,
) => ProgramStream;
