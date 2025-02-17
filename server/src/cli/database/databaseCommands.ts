import type { CommandModule } from 'yargs';
import { DatabaseListMigrationsCommand } from './DatabaseListMigrationsCommand.ts';
import { DatabaseMigrateDownCommand } from './DatabaseMigrateDownCommand.ts';
import { DatabaseMigrateToLatestCommand } from './DatabaseMigrateToLatestCommand.ts';
import { DatabaseMigrateUpCommand } from './DatabaseMigrateUpCommand .ts';

export const databaseCommands: CommandModule = {
  command: 'db <command>',
  describe: 'Database commands',
  builder: (yargs) => yargs.command(databaseMigrationCommands),
  handler: () => {},
};

const databaseMigrationCommands: CommandModule = {
  command: 'migration <command>',
  describe: 'Database migration commands',
  builder: (yargs) =>
    yargs.command([
      DatabaseListMigrationsCommand,
      DatabaseMigrateDownCommand,
      DatabaseMigrateUpCommand,
      DatabaseMigrateToLatestCommand,
    ]),
  handler: () => {},
};
