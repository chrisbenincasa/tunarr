import { PlexDvr } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { ChannelCache } from '../channelCache.js';
import { withDb } from '../dao/dataSource.js';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import { Settings, defaultXmlTvSettings } from '../dao/settings.js';
import createLogger from '../logger.js';
import { Plex } from '../plex.js';
import { ServerContext } from '../serverContext.js';
import { TVGuideService } from '../services/tvGuideService.js';
import { Maybe } from '../types.js';
import type { Tag } from '@tunarr/types';
import { mapAsyncSeq } from '../util/index.js';
import { Task } from './task.js';
import { fileExists } from '../util/fsUtil.js';
import { globalOptions } from '../globals.js';

const logger = createLogger(import.meta);

export class UpdateXmlTvTask extends Task<void> {
  private channelCache: ChannelCache;
  private dbAccess: Settings;
  private guideService: TVGuideService;

  public static ID = 'update-xmltv' as Tag<'update-xmltv', void>;
  public ID = UpdateXmlTvTask.ID;

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

  get taskName() {
    return UpdateXmlTvTask.name;
  }

  protected runInternal(): Promise<Maybe<void>> {
    return this.updateXmlTv();
  }

  private async updateXmlTv() {
    try {
      let xmltvSettings = this.dbAccess.xmlTvSettings();
      if (!(await fileExists(xmltvSettings.outputPath))) {
        logger.debug(
          'XMLTV settings missing at path %s. Regenerating path.',
          xmltvSettings.outputPath,
        );
        await this.dbAccess.updateSettings('xmltv', {
          ...xmltvSettings,
          outputPath: defaultXmlTvSettings(globalOptions().database).outputPath,
        });
        // Re-read
        xmltvSettings = this.dbAccess.xmlTvSettings();
      }

      await this.guideService.refreshGuide(
        dayjs.duration({ hours: xmltvSettings.programmingHours }),
      );

      logger.info('XMLTV Updated at ' + new Date().toLocaleString());
    } catch (err) {
      logger.error('Unable to update TV guide', err);
      return;
    }

    const channels = await this.getChannelsCached();

    const allPlexServers = await withDb((em) => {
      return em.find(PlexServerSettings, {});
    });

    await mapAsyncSeq(allPlexServers, async (plexServer) => {
      const plex = new Plex(plexServer);
      let dvrs: PlexDvr[] = [];

      if (!plexServer.sendGuideUpdates && !plexServer.sendChannelUpdates) {
        return;
      }

      try {
        dvrs = await plex.getDvrs(); // Refresh guide and channel mappings
      } catch (err) {
        logger.error(
          `Couldn't get DVRS list from ${plexServer.name}. This error will prevent 'refresh guide' or 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
          err,
        );
        return;
      }

      if (dvrs.length === 0) {
        return;
      }

      if (plexServer.sendGuideUpdates) {
        try {
          await plex.refreshGuide(dvrs);
        } catch (err) {
          logger.error(
            `Couldn't tell Plex ${plexServer.name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.`,
            err,
          );
        }
      }

      if (plexServer.sendChannelUpdates && channels.length !== 0) {
        try {
          await plex.refreshChannels(channels, dvrs);
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
