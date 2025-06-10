import type { CommandModule } from 'yargs';
import { ScheduleTimeSlotsCommand } from './ScheduleTimeSlotsCommand.ts';

export const schedulingCommands: CommandModule = {
  command: 'schedule <command>',
  describe: 'Generate schedules',
  builder: (yargs) => yargs.command(ScheduleTimeSlotsCommand), //.command(SettingsUpdateCommand),
  handler: () => {},
};
