import { OutputFormat } from '@/ffmpeg/builder/constants.ts';
import { PlayerContext } from '@/stream/PlayerStreamContext.ts';
import { ProgramStream } from '@/stream/ProgramStream.ts';

export interface ProgramStreamFactory {
  build(context: PlayerContext, outputFormat: OutputFormat): ProgramStream;
}
