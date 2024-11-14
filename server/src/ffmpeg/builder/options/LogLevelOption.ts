import { type FfmpegLogLevel } from '@tunarr/types/schemas';
import { ConstantGlobalOption } from './GlobalOption.ts';

export class LogLevelOption extends ConstantGlobalOption {
  constructor(level: FfmpegLogLevel = 'error' as const) {
    super(['-loglevel', level]);
  }
}
