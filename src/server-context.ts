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

// Temp
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbAccess, getDB } from './dao/db.js';
import { serverOptions } from './globals.js';
import { ChannelCache } from './channel-cache.js';
import { XmlTvWriter } from './xmltv.js';
import { PlexServerDB } from './dao/plex-server-db.js';

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
  await getDB();

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

export type ServerContext = {
  db: any;
  channelDB: ChannelDB;
  fillerDB: FillerDB;
  fileCache: FileCacheService;
  cacheImageService: CacheImageService;
  m3uService: M3uService;
  eventService: EventService;
  guideService: TVGuideService;
  hdhrService: any;
  customShowDB: CustomShowDB;
  channelCache: ChannelCache;
  xmltv: XmlTvWriter;
  plexServerDB: PlexServerDB;
  dbAccess: DbAccess;
};

export const serverContext: () => Promise<ServerContext> = once(async () => {
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
  const fillerDB = new FillerDB(channelDB, channelCache, dbAccess);
  const fileCache = new FileCacheService(path.join(opts.database, 'cache'));
  const cacheImageService = new CacheImageService(db, fileCache);
  const m3uService = new M3uService(fileCache, channelCache);
  const eventService = new EventService();
  const xmltv = new XmlTvWriter();

  await initDB(db, channelDB);

  const guideService = new TVGuideService(
    xmltv,
    cacheImageService,
    eventService,
  );

  const customShowDB = new CustomShowDB(dbAccess);

  return {
    db,
    channelDB,
    fillerDB,
    fileCache,
    cacheImageService,
    m3uService,
    eventService,
    guideService,
    hdhrService: hdhr(dbAccess, channelDB),
    customShowDB,
    channelCache,
    xmltv,
    plexServerDB: new PlexServerDB(
      channelDB,
      channelCache,
      fillerDB,
      customShowDB,
      dbAccess,
    ),
    dbAccess,
  };
});
