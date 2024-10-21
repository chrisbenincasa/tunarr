import { CommandModule } from 'yargs';
import { SettingsUpdateCommand } from './settingsUpdateCommand';
import { SettingsViewCommand } from './settingsViewCommand';

export const settingsCommands: CommandModule = {
  command: 'settings <command>',
  describe: 'View/Update settings',
  builder: (yargs) =>
    yargs.command(SettingsViewCommand).command(SettingsUpdateCommand),
  handler: () => {},
};
