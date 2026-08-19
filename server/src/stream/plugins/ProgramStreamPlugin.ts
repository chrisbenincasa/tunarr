import type { OutputFormat } from '../../ffmpeg/builder/constants.ts';
import type {
  StreamOptions,
  TranscodeSessionResult,
} from '../../ffmpeg/types.ts';
import type { Result } from '../../types/result.ts';
import type { PlayerContext } from '../PlayerStreamContext.ts';

export type PluginContext = {
  playerContext: PlayerContext;
  outputFormat: OutputFormat;
  opts?: Partial<StreamOptions>;
  transcodeSession: TranscodeSessionResult;
};

export interface ProgramStreamPlugin {
  run(context: PluginContext): Promise<Result<void>>;

  shutdown(): Promise<Result<void>>;
}
