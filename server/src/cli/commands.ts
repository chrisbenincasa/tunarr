import { GenerateOpenApiCommand } from './GenerateOpenApiCommand.ts';
import { RunServerCommand } from './RunServerCommand.ts';
import { StartWorkerCommand } from './StartWorkerCommand.ts';
import { databaseCommands } from './database/databaseCommands.ts';
import { LegacyMigrateCommand } from './legacyMigrateCommand.ts';
import { RunFixerCommand } from './runFixerCommand.ts';
import { settingsCommands } from './settings/settingsCommands.ts';

export const commands = [
  settingsCommands,
  LegacyMigrateCommand,
  RunFixerCommand,
  RunServerCommand,
  databaseCommands,
  GenerateOpenApiCommand,
  StartWorkerCommand,
];
