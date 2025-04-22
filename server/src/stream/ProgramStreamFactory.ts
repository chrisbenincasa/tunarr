import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { PlayerContext } from './PlayerStreamContext.js';
import type { ProgramStream } from './ProgramStream.js';

/**
 * Creates a {@link ProgramStream} baased on the given context
 */
export type ProgramStreamFactory = (
  context: PlayerContext,
  outputFormat: OutputFormat,
) => ProgramStream;
