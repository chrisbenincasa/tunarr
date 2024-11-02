import { RunServerCommand } from './RunServerCommand.ts';
import { LegacyMigrateCommand } from './legacyMigrateCommand.ts';
import { RunFixerCommand } from './runFixerCommand.ts';
import { settingsCommands } from './settings/settingsCommands.ts';

export const commands = [
  settingsCommands,
  LegacyMigrateCommand,
  RunFixerCommand,
  RunServerCommand,
];
