import { defineConfig } from '@mikro-orm/better-sqlite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import baseConfig from './mikro-orm.base.config.js';

export default defineConfig({
  ...baseConfig,
  entities: ['./dao/entities'], // path to our JS entities (dist), relative to `baseDir`
  entitiesTs: ['./src/dao/entities'], // path to our TS entities (src), relative to `baseDir`
  metadataProvider: TsMorphMetadataProvider,
});
