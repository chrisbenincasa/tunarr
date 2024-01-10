import { Loaded, wrap } from '@mikro-orm/core';
import { ChannelCache } from '../channelCache.js';
import { withDb } from '../dao/dataSource.js';
import { Settings } from '../dao/settings.js';
import { Channel } from '../dao/entities/Channel.js';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import createLogger from '../logger.js';
import { Plex } from '../plex.js';
import { ServerContext } from '../serverContext.js';
import { TVGuideService } from '../services/tvGuideService.js';
import { Maybe } from '../types.js';
import { mapAsyncSeq } from '../util.js';
import { Task, TaskId } from './task.js';

const logger = createLogger(import.meta);

export class UpdateXmlTvTask extends Task<void> {
  private channelCache: ChannelCache;
  private dbAccess: Settings;
  private guideService: TVGuideService;

  public static ID: TaskId = 'update-xmltv';
  public ID: TaskId = UpdateXmlTvTask.ID;
  public static name = 'Update XMLTV Task';

  static create(serverContext: ServerContext): UpdateXmlTvTask {
    return new UpdateXmlTvTask(
      serverContext.channelCache,
      serverContext.settings,
      serverContext.guideService,
    );
  }

  constructor(
    channelCache: ChannelCache,
    dbAccess: Settings,
    guideService: TVGuideService,
  ) {
    super();
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
    let channels: Loaded<Channel, 'programs'>[] = [];

    try {
      channels = await this.channelCache.getAllChannelsWithPrograms();
      const xmltvSettings = this.dbAccess.xmlTvSettings();
      const channelDtos = channels.map((c) => wrap(c)).map((e) => e.toJSON());
      const t = this.guideService.prepareRefresh(
        channelDtos,
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

    channels = await this.getChannelsCached();

    const allPlexServers = await withDb((em) => {
      return em.find(PlexServerSettings, {});
    });

    await mapAsyncSeq(allPlexServers, undefined, async (plexServer) => {
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
    });
  }

  private getChannelsCached() {
    return this.channelCache.getAllChannelsWithPrograms();
  }
}
