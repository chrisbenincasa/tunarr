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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.env.DB_PATH ?? '.dizquetv', 'db.db');

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
    path: './migrations',
    pathTs: './src/migrations',
  },
  extensions: [Migrator],
});
