import { defaultXmlTvSettings } from '@/db/SettingsDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { globalOptions } from '@/globals.js';
import { TVGuideService } from '@/services/TvGuideService.js';
import { LineupCreator } from '@/services/dynamic_channels/LineupCreator.js';
import { KEYS } from '@/types/inject.js';
import { fileExists } from '@/util/fsUtil.js';
import { isNonEmptyString, mapAsyncSeq } from '@/util/index.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { PlexDvr } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import z from 'zod';
import { GlobalScheduler } from '../services/Scheduler.ts';
import { Maybe } from '../types/util.ts';
import { SubtitleExtractorTask } from './SubtitleExtractorTask.ts';
import { Task2 } from './Task.js';
import { taskDef } from './TaskRegistry.ts';

const UpdateXmlTvTaskRequest = z
  .object({
    channelId: z.string().optional(),
  })
  .optional();

type UpdateXmlTvTaskRequest = z.infer<typeof UpdateXmlTvTaskRequest>;

@injectable()
@taskDef({
  description: 'Generates Tunarr guide data and writes an updated EPG',
  schema: UpdateXmlTvTaskRequest,
})
export class UpdateXmlTvTask extends Task2<typeof UpdateXmlTvTaskRequest> {
  public static ID = UpdateXmlTvTask.name;
  public ID = UpdateXmlTvTask.ID;
  schema = UpdateXmlTvTaskRequest;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(TVGuideService) private guideService: TVGuideService,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(new LazyServiceIdentifier(() => MediaSourceApiFactory))
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(LineupCreator) private lineupCreator: LineupCreator,
  ) {
    super(logger);
    this.logger.setBindings({ task: UpdateXmlTvTask.ID });
  }

  get taskName() {
    return UpdateXmlTvTask.name;
  }

  protected runInternal(request: Maybe<UpdateXmlTvTaskRequest>): Promise<void> {
    return this.updateXmlTv(request?.channelId);
  }

  private async updateXmlTv(channelId?: string) {
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

      await this.lineupCreator.promoteAllPendingLineups();

      if (isNonEmptyString(channelId)) {
        await this.guideService.refreshGuide(
          dayjs.duration({ hours: xmltvSettings.programmingHours }),
          channelId,
          true,
        );
      } else {
        await this.guideService.buildAllChannels(
          dayjs.duration({ hours: xmltvSettings.programmingHours }),
          false,
        );
      }

      GlobalScheduler.getScheduledJob(SubtitleExtractorTask.ID)
        .runNow(true)
        .catch((err) => this.logger.error(err));

      this.logger.info('XMLTV Updated at %s', dayjs().format());
    } catch (err) {
      this.logger.error(err, 'Unable to update TV guide');
      return;
    }

    const allMediaSources = await this.mediaSourceDB.findByType('plex');

    await mapAsyncSeq(allMediaSources, async (plexServer) => {
      const plex =
        await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
          plexServer,
        );
      let dvrs: PlexDvr[] = [];

      if (!plexServer.sendGuideUpdates) {
        return;
      }

      try {
        dvrs = await plex.getDvrs(); // Refresh guide and channel mappings
      } catch (err) {
        this.logger.error(
          err,
          `Couldn't get DVRS list from ${plexServer.name}. This error will prevent 'refresh guide' or 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
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
            err,
            `Couldn't tell Plex ${plexServer.name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.`,
          );
        }
      }
    });
  }
}
