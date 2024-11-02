import { LogLevels } from '../util/logging/LoggerFactory.ts';

export type GlobalArgsType = {
  log_level: LogLevels;
  verbose: number;
  database: string;
  // Should this be here?
  force_migration: boolean;
};
