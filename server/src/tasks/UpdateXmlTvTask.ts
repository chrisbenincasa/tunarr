import { defaultXmlTvSettings } from '@/db/SettingsDB.js';
import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { globalOptions } from '@/globals.js';
import { TVGuideService } from '@/services/TvGuideService.js';
import { LineupCreator } from '@/services/dynamic_channels/LineupCreator.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { mapAsyncSeq } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { Tag } from '@tunarr/types';
import { PlexDvr } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Task } from './Task.js';

@injectable()
export class UpdateXmlTvTask extends Task<void> {
  public static ID = 'update-xmltv' as Tag<'update-xmltv', void>;

  protected logger = LoggerFactory.child({
    caller: import.meta,
    task: UpdateXmlTvTask.ID as string,
    className: this.constructor.name,
  });

  public ID = UpdateXmlTvTask.ID;

  constructor(
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(TVGuideService) private guideService: TVGuideService,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  get taskName() {
    return UpdateXmlTvTask.name;
  }

  protected runInternal(): Promise<Maybe<void>> {
    return this.updateXmlTv();
  }

  private async updateXmlTv() {
    try {
      let xmltvSettings = this.settingsDB.xmlTvSettings();
      if (!(await fileExists(xmltvSettings.outputPath))) {
        this.logger.debug(
          'XMLTV settings missing at path %s. Regenerating path.',
          xmltvSettings.outputPath,
        );
        await this.settingsDB.updateSettings('xmltv', {
          ...xmltvSettings,
          outputPath: defaultXmlTvSettings(globalOptions().databaseDirectory)
            .outputPath,
        });
        // Re-read
        xmltvSettings = this.settingsDB.xmlTvSettings();
      }

      await new LineupCreator().promoteAllPendingLineups();

      await this.guideService.buildAllChannels(
        dayjs.duration({ hours: xmltvSettings.programmingHours }),
      );

      this.logger.info('XMLTV Updated at ' + new Date().toLocaleString());
    } catch (err) {
      this.logger.error('Unable to update TV guide', err);
      return;
    }

    const channels = await this.channelDB.getAllChannels();

    const allMediaSources = await this.mediaSourceDB.findByType('plex');

    await mapAsyncSeq(allMediaSources, async (plexServer) => {
      const plex =
        await this.mediaSourceApiFactory.getPlexApiClient(plexServer);
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
