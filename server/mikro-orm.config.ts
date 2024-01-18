import {
  UnderscoreNamingStrategy,
  defineConfig,
} from '@mikro-orm/better-sqlite';
import path, { dirname } from 'path';
import { globalOptions } from './globals.js';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(globalOptions().database, 'db.db');

export default defineConfig({
  dbName: dbPath,
  baseDir: __dirname,
  entities: ['./build/dao/entities'], // path to our JS entities (dist), relative to `baseDir`
  entitiesTs: ['./dao/entities'], // path to our TS entities (src), relative to `baseDir`
  debug: !!process.env['DATABASE_DEBUG_LOGGING'],
  namingStrategy: UnderscoreNamingStrategy,
  forceUndefined: true,
  dynamicImportProvider: (id) => import(id),
  metadataProvider: TsMorphMetadataProvider,
});
