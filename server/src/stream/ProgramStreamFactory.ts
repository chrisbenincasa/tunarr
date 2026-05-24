import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { StreamOptions } from '../ffmpeg/types.ts';
import type { PlayerContext } from './PlayerStreamContext.js';
import type { ProgramStream } from './ProgramStream.ts';

export type ProgramStreamFactory = (
  context: PlayerContext,
  outputFormat: OutputFormat,
  opts?: Partial<StreamOptions>,
) => ProgramStream;
