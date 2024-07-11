import { AsyncLocalStorage } from 'async_hooks';
import { isUndefined, once } from 'lodash-es';
import path from 'path';
import { XmlTvWriter } from './XmlTvWriter.js';
import { ChannelDB } from './dao/channelDb.js';
import { CustomShowDB } from './dao/customShowDb.js';
import { FillerDB } from './dao/fillerDb.js';
import { PlexServerDB } from './dao/plexServerDb.js';
import { ProgramDB } from './dao/programDB.js';
import { SettingsDB, getSettings } from './dao/settings.js';
import { serverOptions } from './globals.js';
import { HdhrService } from './hdhr.js';
import { CacheImageService } from './services/cacheImageService.js';
import { EventService } from './services/eventService.js';
import { FileCacheService } from './services/fileCacheService.js';
import { M3uService } from './services/m3uService.js';
import { TVGuideService } from './services/tvGuideService.js';
import { ChannelCache } from './stream/ChannelCache.js';
import { StreamProgramCalculator } from './stream/StreamProgramCalculator.js';

export class ServerContext {
  constructor(
    public channelDB: ChannelDB,
    public fillerDB: FillerDB,
    public fileCache: FileCacheService,
    public cacheImageService: CacheImageService,
    public m3uService: M3uService,
    public eventService: EventService,
    public guideService: TVGuideService,
    public hdhrService: HdhrService,
    public customShowDB: CustomShowDB,
    public channelCache: ChannelCache,
    public plexServerDB: PlexServerDB,
    public settings: SettingsDB,
    public programDB: ProgramDB,
  ) {}

  streamProgramCalculator() {
    return new StreamProgramCalculator(this.fillerDB, this.channelDB);
  }
}

export const serverContext: () => ServerContext = once(() => {
  const opts = serverOptions();

  const settings = getSettings();

  const channelDB = new ChannelDB();
  const channelCache = new ChannelCache();
  const fillerDB = new FillerDB(channelCache);
  const fileCache = new FileCacheService(
    path.join(opts.databaseDirectory, 'cache'),
  );
  const cacheImageService = new CacheImageService(fileCache);
  const m3uService = new M3uService(fileCache);
  const eventService = new EventService();

  const guideService = new TVGuideService(
    new XmlTvWriter(),
    eventService,
    channelDB,
  );

  const customShowDB = new CustomShowDB();

  return new ServerContext(
    channelDB,
    fillerDB,
    fileCache,
    cacheImageService,
    m3uService,
    eventService,
    guideService,
    new HdhrService(settings),
    customShowDB,
    channelCache,
    new PlexServerDB(channelDB),
    settings,
    new ProgramDB(),
  );
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

export const getServerContext = () => {
  const ctx = ServerRequestContext.currentServerContext();
  if (isUndefined(ctx)) throw new Error('No current server context!!');
  return ctx;
};

export const withServerContext = <T>(f: (ctx: ServerContext) => T) => {
  return f(getServerContext());
};

export const withServerContextAsync = async <T>(
  f: (ctx: ServerContext) => Promise<T>,
) => {
  return await f(getServerContext());
};
