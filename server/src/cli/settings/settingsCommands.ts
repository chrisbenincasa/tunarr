import type { CommandModule } from 'yargs';
import { SettingsUpdateCommand } from './settingsUpdateCommand.ts';
import { SettingsViewCommand } from './settingsViewCommand.ts';

export const settingsCommands: CommandModule = {
  command: 'settings <command>',
  describe: 'View/Update settings',
  builder: (yargs) =>
    yargs.command(SettingsViewCommand).command(SettingsUpdateCommand),
  handler: () => {},
};
