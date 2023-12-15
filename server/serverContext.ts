import fs, { promises as fsPromises } from 'fs';
import { once } from 'lodash-es';
import path from 'path';
import { ChannelCache } from './channelCache.js';
import { ChannelDB } from './dao/channelDb.js';
import { CustomShowDB } from './dao/customShowDb.js';
import { Settings, getSettings } from './dao/settings.js';
import { FillerDB } from './dao/fillerDb.js';
import { PlexServerDB } from './dao/plexServerDb.js';
import { serverOptions } from './globals.js';
import { HdhrService } from './hdhr.js';
import { CacheImageService } from './services/cacheImageService.js';
import { EventService } from './services/eventService.js';
import { FileCacheService } from './services/fileCacheService.js';
import { M3uService } from './services/m3uService.js';
import { TVGuideService } from './services/tvGuideService.js';
import { XmlTvWriter } from './xmltv.js';

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

function initDBDirectory() {
  return Promise.all([
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
  channelDB: ChannelDB;
  fillerDB: FillerDB;
  fileCache: FileCacheService;
  cacheImageService: CacheImageService;
  m3uService: M3uService;
  eventService: EventService;
  guideService: TVGuideService;
  hdhrService: HdhrService;
  customShowDB: CustomShowDB;
  channelCache: ChannelCache;
  xmltv: XmlTvWriter;
  plexServerDB: PlexServerDB;
  settings: Settings;
};

export const serverContext: () => Promise<ServerContext> = once(async () => {
  const opts = serverOptions();

  const settings = await getSettings();

  const channelDB = new ChannelDB();
  const channelCache = new ChannelCache(channelDB);
  const fillerDB = new FillerDB(channelDB, channelCache);
  const fileCache = new FileCacheService(path.join(opts.database, 'cache'));
  const cacheImageService = new CacheImageService(fileCache);
  const m3uService = new M3uService(fileCache, channelCache);
  const eventService = new EventService();
  const xmltv = new XmlTvWriter();

  await initDBDirectory();

  const guideService = new TVGuideService(
    xmltv,
    cacheImageService,
    eventService,
    channelDB,
  );

  const customShowDB = new CustomShowDB();

  return {
    channelDB,
    fillerDB,
    fileCache,
    cacheImageService,
    m3uService,
    eventService,
    guideService,
    hdhrService: new HdhrService(settings, channelDB),
    customShowDB,
    channelCache,
    xmltv,
    plexServerDB: new PlexServerDB(),
    settings,
  };
});
