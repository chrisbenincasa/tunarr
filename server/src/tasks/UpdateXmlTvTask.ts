import type { Tag } from '@tunarr/types';
import { PlexDvr } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { ChannelDB } from '../dao/channelDb.js';
import { withDb } from '../dao/dataSource.js';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import { SettingsDB, defaultXmlTvSettings } from '../dao/settings.js';
import { Plex } from '../external/plex.js';
import { globalOptions } from '../globals.js';
import { ServerContext } from '../serverContext.js';
import { TVGuideService } from '../services/tvGuideService.js';
import { Maybe } from '../types/util.js';
import { fileExists } from '../util/fsUtil.js';
import { mapAsyncSeq } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { Task } from './Task.js';

export class UpdateXmlTvTask extends Task<void> {
  public static ID = 'update-xmltv' as Tag<'update-xmltv', void>;

  protected logger = LoggerFactory.child({
    caller: import.meta,
    task: UpdateXmlTvTask.ID as string,
  });
  #channelDB: ChannelDB;
  #settingsDB: SettingsDB;
  #guideService: TVGuideService;

  public ID = UpdateXmlTvTask.ID;

  static create(serverContext: ServerContext): UpdateXmlTvTask {
    return new UpdateXmlTvTask(
      serverContext.channelDB,
      serverContext.settings,
      serverContext.guideService,
    );
  }

  private constructor(
    channelDB: ChannelDB,
    dbAccess: SettingsDB,
    guideService: TVGuideService,
  ) {
    super();
    this.#channelDB = channelDB;
    this.#settingsDB = dbAccess;
    this.#guideService = guideService;
  }

  get taskName() {
    return UpdateXmlTvTask.name;
  }

  protected runInternal(): Promise<Maybe<void>> {
    return this.updateXmlTv();
  }

  private async updateXmlTv() {
    try {
      let xmltvSettings = this.#settingsDB.xmlTvSettings();
      if (!(await fileExists(xmltvSettings.outputPath))) {
        this.logger.debug(
          'XMLTV settings missing at path %s. Regenerating path.',
          xmltvSettings.outputPath,
        );
        await this.#settingsDB.updateSettings('xmltv', {
          ...xmltvSettings,
          outputPath: defaultXmlTvSettings(globalOptions().databaseDirectory)
            .outputPath,
        });
        // Re-read
        xmltvSettings = this.#settingsDB.xmlTvSettings();
      }

      await this.#guideService.refreshGuide(
        dayjs.duration({ hours: xmltvSettings.programmingHours }),
      );

      this.logger.info('XMLTV Updated at ' + new Date().toLocaleString());
    } catch (err) {
      this.logger.error('Unable to update TV guide', err);
      return;
    }

    const channels = await this.#channelDB.getAllChannels();

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
        this.logger.error(
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
          this.logger.error(
            `Couldn't tell Plex ${plexServer.name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.`,
            err,
          );
        }
      }

      if (plexServer.sendChannelUpdates && channels.length !== 0) {
        try {
          await plex.refreshChannels(channels, dvrs);
        } catch (err) {
          this.logger.error(
            `Couldn't tell Plex ${plexServer.name} to refresh channels for some reason. This error will prevent 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
            err,
          );
        }
      }
    });
  }
}
