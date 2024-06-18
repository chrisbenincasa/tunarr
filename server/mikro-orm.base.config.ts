import {
  UnderscoreNamingStrategy,
  defineConfig,
} from '@mikro-orm/better-sqlite';
import { Migrator } from '@mikro-orm/migrations';
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'path';
import { CachedImage } from './src/dao/entities/CachedImage.js';
import { Channel } from './src/dao/entities/Channel.js';
import { ChannelFillerShow } from './src/dao/entities/ChannelFillerShow.js';
import { CustomShow } from './src/dao/entities/CustomShow.js';
import { CustomShowContent } from './src/dao/entities/CustomShowContent.js';
import { FillerListContent } from './src/dao/entities/FillerListContent.js';
import { FillerShow } from './src/dao/entities/FillerShow.js';
import { PlexServerSettings } from './src/dao/entities/PlexServerSettings.js';
import { Program } from './src/dao/entities/Program.js';
import { DATABASE_LOCATION_ENV_VAR } from './src/util/constants.js';
import { Migration20240124115044 } from './src/migrations/Migration20240124115044.js';
import { Migration20240126165808 } from './src/migrations/Migration20240126165808.js';
import { Migration20240221201014 } from './src/migrations/Migration20240221201014.js';
import { Migration20240308184352 } from './src/migrations/Migration20240308184352.js';
import { Migration20240319192121 } from './src/migrations/Migration20240319192121.js';
import { Migration20240404182303 } from './src/migrations/Migration20240404182303.js';
import { Migration20240411104034 } from './src/migrations/Migration20240411104034.js';
import { Migration20240416113447 } from './src/migrations/Migration20240416113447.js';
import { Migration20240423195250 } from './src/migrations/Migration20240423195250.js';
import { Migration20240531155641 } from './src/migrations/Migration20240531155641.js';
import { Migration20240603204620 } from './src/migrations/Migration20240603204620.js';
import { Migration20240603204638 } from './src/migrations/Migration20240603204638.js';
import { Migration20240618005544 } from './src/migrations/Migration20240618005544.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(
  process.env[DATABASE_LOCATION_ENV_VAR] ?? '.tunarr',
  'db.db',
);

export default defineConfig({
  dbName: dbPath,
  baseDir: __dirname,
  entities: [
    CachedImage,
    Channel,
    ChannelFillerShow,
    CustomShow,
    CustomShowContent,
    FillerListContent,
    FillerShow,
    PlexServerSettings,
    Program,
  ],
  debug: !!process.env['DATABASE_DEBUG_LOGGING'],
  namingStrategy: UnderscoreNamingStrategy,
  forceUndefined: true,
  dynamicImportProvider: (id) => import(id),
  migrations: {
    // Explicitly list migrations for a smoother dev experience
    // and because we are bundling these.
    migrationsList: [
      {
        // We cannot rename existing migrations because it breaks the world
        // 'Initial migration',
        name: 'Migration20240124115044',
        class: Migration20240124115044,
      },
      {
        // 'Add index to filler content',
        name: 'Migration20240126165808',
        class: Migration20240126165808,
      },
      {
        // 'Filler context index fix',
        name: 'Migration20240221201014',
        class: Migration20240221201014,
      },
      {
        // 'Add Plex client identifier column',
        name: 'Migration20240308184352',
        class: Migration20240308184352,
      },
      {
        // 'Add artist and album name fields to Program',
        name: 'Migration20240319192121',
        class: Migration20240319192121,
      },
      {
        // 'Implement program grouping table and hierarchy',
        name: 'Migration20240404182303',
        class: Migration20240404182303,
      },
      {
        // 'Deprecate plex_rating_key field on Program',
        name: 'Migration20240411104034',
        class: Migration20240411104034,
      },
      {
        // 'Add guide_flex_title field',
        name: 'Migration20240416113447',
        class: Migration20240416113447,
      },
      {
        // 'Rename season column to season_number on Program',
        name: 'Migration20240423195250',
        class: Migration20240423195250,
      },
      {
        // 'Add program_external_id table',
        name: 'Migration20240531155641',
        class: Migration20240531155641,
      },
      {
        name: 'Add new external ID types to program_external_id',
        class: Migration20240603204638,
      },
      {
        name: 'Program External ID partial indexes',
        class: Migration20240603204620,
      },
      {
        name: 'Force regenerate program_external_id table',
        class: Migration20240618005544,
      },
    ],
  },
  extensions: [Migrator],
});
