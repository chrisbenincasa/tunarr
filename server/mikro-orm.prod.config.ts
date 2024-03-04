import { GeneratedCacheAdapter, defineConfig } from '@mikro-orm/better-sqlite';
import baseConfig from './mikro-orm.base.config.js';
import metadataJson from './temp/metadata.json' assert { type: 'json' };

export default defineConfig({
  ...baseConfig,
  metadataCache: {
    enabled: true,
    adapter: GeneratedCacheAdapter,
    options: {
      data: metadataJson,
    },
  },
});
