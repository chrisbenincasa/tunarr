import { getDatabase } from '@/db/DBAccess.ts';
import { StreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import { DB } from '@/db/schema/db.ts';
import { JellyfinItemFinder } from '@/external/jellyfin/JellyfinItemFinder.ts';
import { ContentSourceUpdaterFactory } from '@/services/dynamic_channels/ContentSourceUpdaterFactory.ts';
import { LineupCreator } from '@/services/dynamic_channels/LineupCreator.ts';
import { PlexContentSourceUpdater } from '@/services/dynamic_channels/PlexContentSourceUpdater.ts';
import {
  ErrorProgramStreamFactory,
  OfflineProgramStreamFactory,
} from '@/stream/OfflinePlayer.ts';
import { ProgramStreamFactory } from '@/stream/ProgramStreamFactory.ts';
import {
  ContentBackedProgramStreamFactory,
  ProgramStreamProvider,
} from '@/stream/ProgramStreamProvider.ts';
import { JellyfinProgramStreamFactory } from '@/stream/jellyfin/JellyfinProgramStream.ts';
import { PlexProgramStreamFactory } from '@/stream/plex/PlexProgramStream.ts';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.ts';
import { Provider, makeProvider } from '@/util/Provider.ts';
import { devAssert } from '@/util/debug.ts';
import { AsyncLocalStorage } from 'async_hooks';
import { Kysely } from 'kysely';
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
  public readonly programConverter: ProgramConverter;
  public readonly sessionManager: SessionManager;
  public readonly onDemandChannelService: OnDemandChannelService;
  public readonly healthCheckService: HealthCheckService;
  public readonly programStreamProvider: ProgramStreamProvider;
  public readonly channelDB: ChannelDB;
  public readonly fillerDB: FillerDB;
  public readonly fileCache: FileCacheService;
  public readonly cacheImageService: CacheImageService;
  public readonly m3uService: M3uService;
  public readonly eventService: EventService;
  public readonly guideService: TVGuideService;
  public readonly hdhrService: HdhrService;
  public readonly customShowDB: CustomShowDB;
  public readonly channelCache: ChannelCache;
  public readonly mediaSourceDB: MediaSourceDB;
  public readonly programDB: ProgramDB;
  public readonly contentSourceUpdaterFactory: ContentSourceUpdaterFactory;

  constructor(
    public readonly dbAccess: Kysely<DB>,
    public readonly settings: SettingsDB,
  ) {
    const opts = serverOptions();

    this.programDB = new ProgramDB(
      this.dbAccess,
      makeProvider(() => this.channelDB),
    );
    this.channelDB = new ChannelDB(this.dbAccess, this.programDB);
    this.channelCache = new ChannelCache();
    this.fillerDB = new FillerDB(
      this.dbAccess,
      this.channelCache,
      this.programDB,
    );
    this.fileCache = new FileCacheService(
      path.join(opts.databaseDirectory, 'cache'),
    );
    this.cacheImageService = new CacheImageService(
      this.dbAccess,
      this.fileCache,
    );
    this.m3uService = new M3uService(this.fileCache, this.channelDB);
    this.eventService = new EventService();
    this.programConverter = new ProgramConverter(this.dbAccess);
    this.guideService = new TVGuideService(
      new XmlTvWriter(this.settings),
      this.eventService,
      this.channelDB,
      this.programDB,
      this.programConverter,
    );
    this.hdhrService = new HdhrService(this.settings);
    this.customShowDB = new CustomShowDB(this.dbAccess, this.programDB);
    this.mediaSourceDB = new MediaSourceDB(this.dbAccess, this.channelDB);

    this.onDemandChannelService = new OnDemandChannelService(this.channelDB);
    this.healthCheckService = new HealthCheckService(dbAccess, settings);
    this.sessionManager = SessionManager.create(this);

    this.programStreamProvider = new ProgramStreamProvider(
      new Map<StreamLineupItem['type'], ProgramStreamFactory>([
        ['program', this.contentBackedProgramStreamFactory],
        ['commercial', this.contentBackedProgramStreamFactory],
        ['offline', new OfflineProgramStreamFactory(this.settings)],
        ['error', new ErrorProgramStreamFactory(this.settings)],
      ]),
    );

    this.contentSourceUpdaterFactory = new ContentSourceUpdaterFactory(
      new Map([['plex', new PlexContentSourceUpdaterProvider(this)]]),
    );
  }

  streamProgramCalculator() {
    return new StreamProgramCalculator(
      this.fillerDB,
      this.channelDB,
      this.channelCache,
      this.programDB,
    );
  }

  get lineupCreator() {
    return new LineupCreator(this.dbAccess, this.channelDB);
  }

  get contentBackedProgramStreamFactory() {
    return new ContentBackedProgramStreamFactory(
      new PlexProgramStreamFactory(
        this.settings,
        this.mediaSourceDB,
        makeProvider(
          () => new PlexStreamDetails(this.settings, this.programDB),
        ),
      ),
      new JellyfinProgramStreamFactory(
        this.settings,
        this.mediaSourceDB,
        this.jellyfinItemFinderProvider,
      ),
    );
  }

  get jellyfinItemFinderProvider(): Provider<JellyfinItemFinder> {
    return makeProvider(
      () =>
        new JellyfinItemFinder(this.programDB, this.dbAccess, this.channelDB),
    );
  }
}

class PlexContentSourceUpdaterProvider
  implements Provider<PlexContentSourceUpdater>
{
  constructor(private serverContext: ServerContext) {}

  get(): PlexContentSourceUpdater {
    return new PlexContentSourceUpdater(
      this.serverContext.channelDB,
      this.serverContext.mediaSourceDB,
      this.serverContext.programDB,
    );
  }
}

export const serverContext: () => ServerContext = once(() => {
  const db = getDatabase();
  devAssert(!isUndefined(db));
  return new ServerContext(db, getSettings());
});

// class JellyfinStreamDetailsProvider implements Provider<JellyfinStreamDetails> {
//   constructor(private serverContext: ServerContext) {}

//   get(): JellyfinStreamDetails {
//     return new JellyfinStreamDetails(
//       this.serverContext.settings,
//       this.serverContext.jellyfinItemFinderProvider.get(),
//     );
//   }
// }

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
