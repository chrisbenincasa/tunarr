import { AsyncLocalStorage } from 'node:async_hooks';
import { inject, injectable } from 'npm:inversify';
import { isUndefined } from 'npm:lodash-es';
import { CustomShowDB } from './db/CustomShowDB.ts';
import { FillerDB } from './db/FillerListDB.ts';
import { TranscodeConfigDB } from './db/TranscodeConfigDB.ts';
import { ProgramConverter } from './db/converters/ProgramConverter.ts';
import type { IChannelDB } from './db/interfaces/IChannelDB.ts';
import type { IProgramDB } from './db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from './db/interfaces/ISettingsDB.ts';
import { MediaSourceDB } from './db/mediaSourceDB.ts';
import { LegacyDbMigrator } from './migration/legacy_migration/legacyDbMigration.ts';
import { ChannelLineupMigrator } from './migration/lineups/ChannelLineupMigrator.ts';
import { EventService } from './services/EventService.ts';
import { FileCacheService } from './services/FileCacheService.ts';
import { HdhrService } from './services/HDHRService.ts';
import { HealthCheckService } from './services/HealthCheckService.ts';
import { M3uService } from './services/M3UService.ts';
import { OnDemandChannelService } from './services/OnDemandChannelService.ts';
import { TVGuideService } from './services/TvGuideService.ts';
import type { CacheImageService } from './services/cacheImageService.ts';
import { ChannelCache } from './stream/ChannelCache.ts';
import { SessionManager } from './stream/SessionManager.ts';
import { StreamProgramCalculator } from './stream/StreamProgramCalculator.ts';
import { FixerRunner } from './tasks/fixers/FixerRunner.ts';
import { KEYS } from './types/inject.ts';

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
