import db from 'diskdb';
import fs, { promises as fsPromises } from 'fs';
import { once } from 'lodash-es';
import path from 'path';
import { ChannelDB } from './dao/channel-db.js';
import { CustomShowDB } from './dao/custom-show-db.js';
import { FillerDB } from './dao/filler-db.js';
import * as dbMigration from './database-migration.js';
import { hdhr } from './hdhr.js';
import { CacheImageService } from './services/cache-image-service.js';
import { EventService } from './services/event-service.js';
import { FileCacheService } from './services/file-cache-service.js';
import { M3uService } from './services/m3u-service.js';
import { TVGuideService } from './services/tv-guide-service.js';
import * as xmltv from './xmltv.js';

// Temp
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDB } from './dao/db.js';
import { serverOptions } from './globals.js';
import { ChannelCache } from './channel-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function copyIfMissingFromDatabase(
  targetPath: string,
  resourcePath: string,
): Promise<void> {
  const opts = serverOptions();
  if (!fs.existsSync(path.join(opts.database, targetPath))) {
    await fsPromises.copyFile(
      new URL('../' + resourcePath, import.meta.url),
      path.join(opts.database, targetPath),
    );
  }
}

async function initDB(db: any, channelDB: ChannelDB) {
  getDB();

  dbMigration.initDB(db, channelDB, __dirname);
  await Promise.all([
    copyIfMissingFromDatabase('images/dizquetv.png', 'resources/dizquetv.png'),
    copyIfMissingFromDatabase('font.ttf', 'resources/font.ttf'),
    copyIfMissingFromDatabase(
      'images/generic-error-screen.png',
      'resources/generic-error-screen.png',
    ),
    copyIfMissingFromDatabase(
      'images/generic-offline-screen.png',
      'resources/generic-offline-screen.png',
    ),
    copyIfMissingFromDatabase(
      'images/generic-music-screen.png',
      'resources/generic-music-screen.png',
    ),
    copyIfMissingFromDatabase(
      'images/loading-screen.png',
      'resources/loading-screen.png',
    ),
    copyIfMissingFromDatabase('custom.css', 'resources/default-custom.css'),
  ]);
}

export const serverContext = once(async () => {
  const opts = serverOptions();

  db.connect(opts.database, [
    'channels',
    'plex-servers',
    'ffmpeg-settings',
    'plex-settings',
    'xmltv-settings',
    'hdhr-settings',
    'db-version',
    'client-id',
    'cache-images',
    'settings',
  ]);

  const dbAccess = await getDB();

  const channelDB = new ChannelDB(dbAccess);
  const channelCache = new ChannelCache(channelDB);
  const fillerDB = new FillerDB(
    path.join(opts.database, 'filler'),
    channelDB,
    channelCache,
  );
  const fileCache = new FileCacheService(path.join(opts.database, 'cache'));
  const cacheImageService = new CacheImageService(db, fileCache);
  const m3uService = new M3uService(channelDB, fileCache, channelCache);
  const eventService = new EventService();

  await initDB(db, channelDB);

  const guideService = new TVGuideService(
    xmltv,
    db,
    cacheImageService,
    eventService,
  );

  return {
    db,
    channelDB,
    fillerDB,
    fileCache,
    cacheImageService,
    m3uService,
    eventService,
    guideService,
    hdhrService: hdhr(db, channelDB),
    customShowDB: new CustomShowDB(path.join(opts.database, 'custom-shows')),
    channelCache,
  };
});
