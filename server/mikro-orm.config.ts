import type { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { defineConfig } from '@mikro-orm/core';
import { PlexServerSettings } from './dao/entities/PlexServerSettings.js';
import { Program } from './dao/entities/Program.js';
import { Channel } from './dao/entities/Channel.js';
import { CustomShow } from './dao/entities/CustomShow.js';
import { FillerShow } from './dao/entities/FillerShow.js';
import { CachedImage } from './dao/entities/CachedImage.js';
import { ChannelFillerShow } from './dao/entities/ChannelFillerShow.js';

export default defineConfig<BetterSqliteDriver>({
  entities: [
    PlexServerSettings,
    Program,
    Channel,
    CustomShow,
    FillerShow,
    CachedImage,
    ChannelFillerShow,
  ],
  dbName: '.dizquetv/db.db',
  // driver: conf => new SQLite(),
});
