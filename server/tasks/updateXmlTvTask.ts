import { compact } from 'lodash-es';
import { ChannelCache } from '../channelCache.js';
import { ChannelDB } from '../dao/channelDb.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import { Task, TaskId } from './task.js';
import { DbAccess, ImmutableChannel } from '../dao/db.js';
import { TVGuideService } from '../services/tvGuideService.js';
import { sequentialPromises } from '../util.js';
import { Plex } from '../plex.js';
import { ServerContext } from '../serverContext.js';

const logger = createLogger(import.meta);

export class UpdateXmlTvTask extends Task<void> {
  private channelDb: ChannelDB;
  private channelCache: ChannelCache;
  private dbAccess: DbAccess;
  private guideService: TVGuideService;

  public static ID: TaskId = 'update-xmltv';
  public ID: TaskId = UpdateXmlTvTask.ID;
  public static name = 'Update XMLTV Task';

  static create(serverContext: ServerContext): UpdateXmlTvTask {
    return new UpdateXmlTvTask(
      serverContext.channelDB,
      serverContext.channelCache,
      serverContext.dbAccess,
      serverContext.guideService,
    );
  }

  constructor(
    channelDb: ChannelDB,
    channelCache: ChannelCache,
    dbAccess: DbAccess,
    guideService: TVGuideService,
  ) {
    super();
    this.channelDb = channelDb;
    this.channelCache = channelCache;
    this.dbAccess = dbAccess;
    this.guideService = guideService;
  }

  get name() {
    return UpdateXmlTvTask.name;
  }

  protected runInternal(): Promise<Maybe<void>> {
    return this.updateXmlTv();
  }

  private async updateXmlTv() {
    let channels: ImmutableChannel[] = [];

    try {
      channels = await this.channelCache.getAllChannels();
      const xmltvSettings = this.dbAccess.xmlTvSettings();
      const t = this.guideService.prepareRefresh(
        channels,
        xmltvSettings.refreshHours * 60 * 60 * 1000,
      );
      channels = [];

      await this.guideService.refresh(t);
      // xmltvInterval.lastRefresh = new Date();

      logger.info('XMLTV Updated at ' + new Date().toLocaleString());
    } catch (err) {
      logger.error('Unable to update TV guide?', err);
      return;
    }

    channels = this.getChannelsCached();

    await sequentialPromises(
      this.dbAccess.plexServers().getAll(),
      undefined,
      async (plexServer) => {
        const plex = new Plex(plexServer);
        let dvrs;
        if (!plexServer.sendGuideUpdates && !plexServer.sendChannelUpdates) {
          return;
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          dvrs = await plex.GetDVRS(); // Refresh guide and channel mappings
        } catch (err) {
          logger.error(
            `Couldn't get DVRS list from ${plexServer.name}. This error will prevent 'refresh guide' or 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
            err,
          );
          return;
        }
        if (plexServer.sendGuideUpdates) {
          try {
            await plex.RefreshGuide(dvrs);
          } catch (err) {
            logger.error(
              `Couldn't tell Plex ${plexServer.name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.`,
              err,
            );
          }
        }
        if (plexServer.sendChannelUpdates && channels.length !== 0) {
          try {
            await plex.RefreshChannels(channels, dvrs);
          } catch (err) {
            logger.error(
              `Couldn't tell Plex ${plexServer.name} to refresh channels for some reason. This error will prevent 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
              err,
            );
          }
        }
      },
    );
  }

  private getChannelsCached() {
    const channelNumbers = this.channelDb.getAllChannelNumbers();
    return compact(
      channelNumbers.map((x) => {
        return this.channelCache.getChannelConfig(x);
      }),
    );
  }
}
