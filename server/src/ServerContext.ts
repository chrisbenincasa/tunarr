import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { ChannelLineupMigrator } from '@/migration/lineups/ChannelLineupMigrator.js';
import { FixerRunner } from '@/tasks/fixers/FixerRunner.js';
import { KEYS } from '@/types/inject.js';
import { inject, injectable, interfaces } from 'inversify';
import { Kysely } from 'kysely';
import { isUndefined } from 'lodash-es';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CustomShowDB } from './db/CustomShowDB.ts';
import { FillerDB } from './db/FillerListDB.ts';
import { SmartCollectionsDB } from './db/SmartCollectionsDB.ts';
import { TranscodeConfigDB } from './db/TranscodeConfigDB.ts';
import { ProgramConverter } from './db/converters/ProgramConverter.ts';
import { MediaSourceDB } from './db/mediaSourceDB.ts';
import { DB } from './db/schema/db.ts';
import { DrizzleDBAccess } from './db/schema/index.ts';
import { MediaSourceApiFactory } from './external/MediaSourceApiFactory.ts';
import { IWorkerPool } from './interfaces/IWorkerPool.ts';
import { EventService } from './services/EventService.ts';
import { FileCacheService } from './services/FileCacheService.ts';
import { HdhrService } from './services/HDHRService.ts';
import { HealthCheckService } from './services/HealthCheckService.js';
import { ImageCache } from './services/ImageCache.ts';
import { M3uService } from './services/M3UService.ts';
import { MediaSourceLibraryRefresher } from './services/MediaSourceLibraryRefresher.ts';
import { MeilisearchService } from './services/MeilisearchService.ts';
import { OnDemandChannelService } from './services/OnDemandChannelService.js';
import { TVGuideService } from './services/TvGuideService.ts';
import { CacheImageService } from './services/cacheImageService.js';
import { MediaSourceScanCoordinator } from './services/scanner/MediaSourceScanCoordinator.ts';
import { ChannelCache } from './stream/ChannelCache.js';
import { SessionManager } from './stream/SessionManager.js';
import { StreamProgramCalculator } from './stream/StreamProgramCalculator.js';

@injectable()
export class ServerContext {
  @inject(ProgramConverter) public readonly programConverter: ProgramConverter;
  @inject(OnDemandChannelService)
  public readonly onDemandChannelService: OnDemandChannelService;
  @inject(KEYS.ChannelDB) public channelDB: IChannelDB;
  @inject(M3uService) public m3uService: M3uService;
  @inject(KEYS.SettingsDB) public settings: ISettingsDB;

  @inject(FillerDB) public fillerDB!: FillerDB;
  public fileCache: FileCacheService = new FileCacheService();
  public cacheImageService: CacheImageService;
  @inject(EventService) public eventService: EventService;
  @inject(TVGuideService) public guideService: TVGuideService;
  @inject(HdhrService) public hdhrService: HdhrService;
  @inject(CustomShowDB) public customShowDB: CustomShowDB;
  @inject(ChannelCache) public channelCache: ChannelCache;
  @inject(MediaSourceDB) public mediaSourceDB: MediaSourceDB;
  @inject(KEYS.ProgramDB) public programDB: IProgramDB;
  @inject(TranscodeConfigDB) public transcodeConfigDB: TranscodeConfigDB;

  @inject(SessionManager) public readonly sessionManager: SessionManager;
  @inject(HealthCheckService)
  public readonly healthCheckService: HealthCheckService;

  @inject(ChannelLineupMigrator)
  public readonly channelLineupMigrator!: ChannelLineupMigrator;

  @inject(FixerRunner) public readonly fixerRunner!: FixerRunner;

  @inject(StreamProgramCalculator)
  public readonly streamProgramCalculator!: StreamProgramCalculator;

  @inject(MediaSourceApiFactory)
  public readonly mediaSourceApiFactory!: MediaSourceApiFactory;

  @inject(KEYS.DatabaseFactory)
  public readonly databaseFactory!: interfaces.AutoFactory<Kysely<DB>>;

  @inject(KEYS.DrizzleDatabaseFactory)
  public readonly drizzleFactory!: interfaces.AutoFactory<DrizzleDBAccess>;

  @inject(KEYS.WorkerPool)
  public readonly workerPool: IWorkerPool;

  @inject(MeilisearchService)
  public readonly searchService!: MeilisearchService;

  @inject(MediaSourceScanCoordinator)
  public readonly mediaSourceScanCoordinator!: MediaSourceScanCoordinator;

  @inject(MediaSourceLibraryRefresher)
  public readonly mediaSourceLibraryRefresher!: MediaSourceLibraryRefresher;

  @inject(ImageCache)
  public readonly imageCache!: ImageCache;

  @inject(SmartCollectionsDB)
  public readonly smartCollectionsDB!: SmartCollectionsDB;
}

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
