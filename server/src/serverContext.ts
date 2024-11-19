import { AsyncLocalStorage } from 'async_hooks';
import { isUndefined, once } from 'lodash-es';
import path from 'path';
import { ChannelDB } from './db/ChannelDB.ts';
import { CustomShowDB } from './db/CustomShowDB.ts';
import { FillerDB } from './db/FillerListDB.ts';
import { ProgramDB } from './db/ProgramDB.ts';
import { SettingsDB, getSettings } from './db/SettingsDB.ts';
import { ProgramConverter } from './db/converters/ProgramConverter.ts';
import { MediaSourceDB } from './db/mediaSourceDB.ts';
import { serverOptions } from './globals.js';
import { EventService } from './services/EventService.ts';
import { FileCacheService } from './services/FileCacheService.ts';
import { HdhrService } from './services/HDHRService.ts';
import { HealthCheckService } from './services/HealthCheckService.js';
import { M3uService } from './services/M3UService.ts';
import { OnDemandChannelService } from './services/OnDemandChannelService.js';
import { TVGuideService } from './services/TvGuideService.ts';
import { XmlTvWriter } from './services/XmlTvWriter.ts';
import { CacheImageService } from './services/cacheImageService.js';
import { ChannelCache } from './stream/ChannelCache.js';
import { SessionManager } from './stream/SessionManager.js';
import { StreamProgramCalculator } from './stream/StreamProgramCalculator.js';

export class ServerContext {
  public readonly programConverter = new ProgramConverter();
  public readonly sessionManager: SessionManager;
  public readonly onDemandChannelService: OnDemandChannelService;
  public readonly healthCheckService: HealthCheckService;

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
    public mediaSourceDB: MediaSourceDB,
    public settings: SettingsDB,
    public programDB: ProgramDB,
  ) {
    this.onDemandChannelService = new OnDemandChannelService(this.channelDB);
    this.sessionManager = SessionManager.create(
      this.channelDB,
      this.onDemandChannelService,
    );
    this.healthCheckService = new HealthCheckService();
  }

  streamProgramCalculator() {
    return new StreamProgramCalculator(
      this.fillerDB,
      this.channelDB,
      this.channelCache,
      this.programDB,
    );
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

  const programDB = new ProgramDB();
  const guideService = new TVGuideService(
    new XmlTvWriter(),
    eventService,
    channelDB,
    programDB,
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
    new MediaSourceDB(channelDB),
    settings,
    programDB,
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
