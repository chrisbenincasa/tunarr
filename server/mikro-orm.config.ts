import {
  GeneratedCacheAdapter,
  UnderscoreNamingStrategy,
  defineConfig,
} from '@mikro-orm/better-sqlite';
import { Migrator } from '@mikro-orm/migrations';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'path';
import metadataJson from './temp/metadata.json' assert { type: 'json' };
import { BaseEntity } from './src/dao/entities/BaseEntity.js';
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
  // entities: ['./dao/entities'], // path to our JS entities (dist), relative to `baseDir`
  // entitiesTs: ['./src/dao/entities'], // path to our TS entities (src), relative to `baseDir`
  entities: [
    // BaseEntity,
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
  // discovery: { disableDynamicFileAccess: true },
  debug: !!process.env['DATABASE_DEBUG_LOGGING'],
  namingStrategy: UnderscoreNamingStrategy,
  forceUndefined: true,
  dynamicImportProvider: (id) => import(id),
  metadataProvider: TsMorphMetadataProvider,
  metadataCache: {
    enabled: true,
    adapter: GeneratedCacheAdapter,
    options: {
      data: metadataJson,
    },
  },
  migrations: {
    path: './migrations',
    pathTs: './src/migrations',
  },
  extensions: [Migrator],
});
