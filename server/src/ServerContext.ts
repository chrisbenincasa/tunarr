import { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { LegacyDbMigrator } from '@/migration/legacy_migration/legacyDbMigration.js';
import { ChannelLineupMigrator } from '@/migration/lineups/ChannelLineupMigrator.js';
import { FixerRunner } from '@/tasks/fixers/FixerRunner.js';
import { KEYS } from '@/types/inject.js';
import { AsyncLocalStorage } from 'async_hooks';
import { inject, injectable } from 'inversify';
import { isUndefined } from 'lodash-es';
import { CustomShowDB } from './db/CustomShowDB.ts';
import { FillerDB } from './db/FillerListDB.ts';
import { TranscodeConfigDB } from './db/TranscodeConfigDB.ts';
import { ProgramConverter } from './db/converters/ProgramConverter.ts';
import { MediaSourceDB } from './db/mediaSourceDB.ts';
import { EventService } from './services/EventService.ts';
import { FileCacheService } from './services/FileCacheService.ts';
import { HdhrService } from './services/HDHRService.ts';
import { HealthCheckService } from './services/HealthCheckService.js';
import { M3uService } from './services/M3UService.ts';
import { OnDemandChannelService } from './services/OnDemandChannelService.js';
import { TVGuideService } from './services/TvGuideService.ts';
import { CacheImageService } from './services/cacheImageService.js';
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
  @inject(FileCacheService) public fileCache: FileCacheService;
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

  @inject(LegacyDbMigrator)
  public readonly legacyDBMigrator!: LegacyDbMigrator;
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
