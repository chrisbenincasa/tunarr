import type { LogLevels } from '@/util/logging/LoggerFactory.js';

export type GlobalArgsType = {
  log_level: LogLevels | undefined;
  verbose: number;
  database: string;
};
