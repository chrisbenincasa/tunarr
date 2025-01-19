import { getSettings } from '@/db/SettingsDB.js';
import { LegacyDbMigrator } from '@/migration/legacy_migration/legacyDbMigration.js';
import { isArray, isString } from 'lodash-es';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CommandModule } from 'yargs';
import { GlobalArgsType } from './types.ts';

type LegacyMigrateCommandArgs = {
  legacy_path: string;
  entities?: string[];
};

const MigratableEntities = [
  'hdhr',
  'xmltv',
  'plex',
  'plex-servers',
  'custom-shows',
  'filler-shows',
  'channels',
  'ffmpeg',
  'cached-images',
];

export const LegacyMigrateCommand: CommandModule<
  GlobalArgsType,
  LegacyMigrateCommandArgs
> = {
  command: 'legacy-migrate',
  describe: 'Migrate from the legacy .dizquetv database',
  builder: {
    legacy_path: {
      type: 'string',
      default: path.join(process.cwd(), '.dizquetv'),
      coerce(arg: string) {
        if (!existsSync(arg)) {
          throw new Error(`No directory found at ${arg}`);
        }
        return arg;
      },
    },
    entities: {
      type: 'array',
      choices: MigratableEntities,
      coerce(arg) {
        if (isArray(arg)) {
          return arg as string[];
        } else if (isString(arg)) {
          return arg.split(',');
        } else {
          throw new Error('Bad arg');
        }
      },
    },
  },
  handler: async (argv) => {
    console.log('Migrating DB from legacy schema...');
    return await new LegacyDbMigrator(
      getSettings(),
      argv.legacy_path,
    ).migrateFromLegacyDb(argv.entities);
  },
};
