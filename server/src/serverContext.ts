import { AsyncLocalStorage } from 'async_hooks';
import { isUndefined, once } from 'lodash-es';
import path from 'path';
import { ChannelCache } from './channelCache.js';
import { ChannelDB } from './dao/channelDb.js';
import { CustomShowDB } from './dao/customShowDb.js';
import { FillerDB } from './dao/fillerDb.js';
import { PlexServerDB } from './dao/plexServerDb.js';
import { ProgramDB } from './dao/programDB.js';
import { Settings, getSettings } from './dao/settings.js';
import { serverOptions } from './globals.js';
import { HdhrService } from './hdhr.js';
import { CacheImageService } from './services/cacheImageService.js';
import { EventService } from './services/eventService.js';
import { FileCacheService } from './services/fileCacheService.js';
import { M3uService } from './services/m3uService.js';
import { TVGuideService } from './services/tvGuideService.js';
import { XmlTvWriter } from './xmltv.js';

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
  programDB: ProgramDB;
};

export const serverContext: () => Promise<ServerContext> = once(async () => {
  const opts = serverOptions();

  const settings = await getSettings();

  const channelDB = new ChannelDB();
  const channelCache = new ChannelCache(channelDB);
  const fillerDB = new FillerDB(channelCache);
  const fileCache = new FileCacheService(path.join(opts.database, 'cache'));
  const cacheImageService = new CacheImageService(fileCache);
  const m3uService = new M3uService(fileCache, channelCache);
  const eventService = new EventService();
  const xmltv = new XmlTvWriter();

  const guideService = new TVGuideService(
    xmltv,
    cacheImageService,
    eventService,
    channelDB,
  );

  const guideService2 = new TVGuideService(
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
    guideService2,
    hdhrService: new HdhrService(settings, channelDB),
    customShowDB,
    channelCache,
    xmltv,
    plexServerDB: new PlexServerDB(channelDB),
    settings,
    programDB: new ProgramDB(),
  };
});

export class ServerRequestContext {
  static storage = new AsyncLocalStorage<ServerContext>();

  static currentServerContext(): ServerContext | undefined {
    return this.storage.getStore();
  }

  static create<T>(context: ServerContext, next: (...args: unknown[]) => T) {
    this.storage.run(context, next);
  }
}

export const withServerContext = <T>(f: (ctx: ServerContext) => T) => {
  const ctx = ServerRequestContext.currentServerContext();
  if (isUndefined(ctx)) throw new Error('No current server context!!');
  return f(ctx);
};

export const withServerContextAsync = async <T>(
  f: (ctx: ServerContext) => Promise<T>,
) => {
  const ctx = ServerRequestContext.currentServerContext();
  if (isUndefined(ctx)) throw new Error('No current server context!!');
  return await f(ctx);
};
