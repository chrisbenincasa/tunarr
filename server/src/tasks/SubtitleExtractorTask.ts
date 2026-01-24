import { seq } from '@tunarr/shared/util';
import { ContentGuideProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { isUndefined } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { dirname, extname } from 'node:path';
import { tmpName } from 'tmp-promise';
import z from 'zod';
import { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { HttpReconnectOptions } from '../ffmpeg/builder/options/input/HttpReconnectOptions.ts';
import { GlobalOptions } from '../globals.ts';
import { TVGuideService } from '../services/TvGuideService.ts';
import { ExternalStreamDetailsFetcherFactory } from '../stream/StreamDetailsFetcher.ts';
import { isImageBasedSubtitle } from '../stream/util.ts';
import { KEYS } from '../types/inject.ts';
import { OpenDateTimeRange } from '../types/OpenDateTimeRange.ts';
import { Result } from '../types/result.ts';
import { ChildProcessHelper } from '../util/ChildProcessHelper.ts';
import {
  CacheFolderName,
  SubtitlesCacheFolderName,
} from '../util/constants.ts';
import { fileExists } from '../util/fsUtil.ts';
import { isDefined } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { getSubtitleCacheFilePath } from '../util/subtitles.ts';
import { Task2 } from './Task.ts';
import { taskDef } from './TaskRegistry.ts';

const ChannelExtractionFilter = z.object({
  type: z.literal('channel'),
  channelId: z.string(),
});

const ProgramExtractionFilter = z.object({
  type: z.literal('program'),
  programId: z.string(),
});

const DurationExtractionFilter = z.object({
  type: z.literal('time'),
  durationMs: z.number(),
});

export type DurationExtractionFilter = z.infer<typeof DurationExtractionFilter>;

const ExtractionFilter = z.discriminatedUnion('type', [
  ChannelExtractionFilter,
  ProgramExtractionFilter,
  DurationExtractionFilter,
]);

const SubtitleExtractorTaskRequest = z.object({
  filter: ExtractionFilter.optional(),
});

export type SubtitleExtractorTaskRequest = z.infer<
  typeof SubtitleExtractorTaskRequest
>;

const defaultFilter = {
  type: 'time',
  durationMs: dayjs.duration({ hours: 1 }).asMilliseconds(),
} satisfies DurationExtractionFilter;

@injectable()
@taskDef({
  name: SubtitleExtractorTask.name,
  description:
    'Extracted embedded, text-based subtitles from scheduled programs',
  schema: SubtitleExtractorTaskRequest,
})
export class SubtitleExtractorTask extends Task2<
  typeof SubtitleExtractorTaskRequest
> {
  static KEY = SubtitleExtractorTask.name;
  static ID = SubtitleExtractorTask.name;
  public ID = SubtitleExtractorTask.ID;

  schema = SubtitleExtractorTaskRequest;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(TVGuideService) private guideService: TVGuideService,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(ExternalStreamDetailsFetcherFactory)
    private streamDetailsFetcher: ExternalStreamDetailsFetcherFactory,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    // private request: SubtitleExtractorTaskRequest,
  ) {
    super(logger);
  }

  protected async runInternal(
    request: SubtitleExtractorTaskRequest,
  ): Promise<void> {
    if (!this.settingsDB.ffmpegSettings().enableSubtitleExtraction) {
      this.logger.trace('Subtitle extraction is not enabled, skipping task.');
      return;
    }

    const filter = request.filter ?? defaultFilter;
    switch (filter.type) {
      case 'time':
        await this.handleTimeFilter(filter);
        break;
      case 'channel':
      case 'program':
        this.logger.debug(
          'Subtitle extraction filter type %s not yet implemented',
          filter.type,
        );
        break;
    }
  }

  private async handleTimeFilter(filter: DurationExtractionFilter) {
    const now = dayjs();

    // On the first run we may have to block if the guide is updating.
    await this.guideService.get();

    const nextHourGuide = await this.guideService.getAllChannelGuides(
      OpenDateTimeRange.create(now, now.add(filter.durationMs))!,
    );
    const mediaSources = await this.mediaSourceDB.getAll();

    for (const { id, programs } of nextHourGuide) {
      const channel = await this.channelDB.getChannel(id);
      if (!channel) {
        this.logger.warn(
          'Could not find channel %s when attempting to extract subtitles',
          id,
        );
        continue;
      }

      if (!channel.subtitlesEnabled) {
        this.logger.trace(
          'Skipping subtitle extraction for channel %s as subtitles are disabled',
          channel.uuid,
        );
        continue;
      }

      for (const program of programs) {
        if (program.type !== 'content') {
          continue;
        }

        const mediaSource = mediaSources.find(
          (ms) =>
            ms.uuid === program.externalSourceId ||
            ms.name === program.externalSourceName,
        );
        if (!mediaSource) {
          // log
          continue;
        }

        const result = await Result.attemptAsync(() =>
          this.handleProgram(program, mediaSource),
        );
        if (result.isFailure()) {
          this.logger.warn(
            result.error,
            'Failed to extract subtitles for program %s',
            program.id,
          );
        }
      }
    }
  }

  private async handleProgram(
    program: ContentGuideProgram,
    mediaSource: MediaSourceWithRelations,
  ) {
    const dbProgram = await this.programDB.getProgramById(program.id);
    if (!dbProgram) {
      return;
    }
    const stream = await this.streamDetailsFetcher.getStream({
      server: mediaSource,
      lineupItem: { ...dbProgram, mediaSourceId: mediaSource.uuid },
    });

    if (stream.isFailure()) {
      this.logger.error(stream.error);
      return;
    }

    const textBasedSubs =
      stream.get().streamDetails.subtitleDetails?.filter((subtitle) => {
        return (
          subtitle.type === 'embedded' && !isImageBasedSubtitle(subtitle.codec)
        );
      }) ?? [];

    const ffmpegSetting = this.settingsDB.ffmpegSettings();

    if (textBasedSubs.length === 0) {
      this.logger.debug('No text-based subtitles for ID: %s', program.id);
      return;
    }

    const cacheFolder = path.join(
      this.globalOptions.databaseDirectory,
      CacheFolderName,
      SubtitlesCacheFolderName,
    );

    // This should've been created on startup but double-check
    if (!(await fileExists(cacheFolder))) {
      await fs.mkdir(cacheFolder);
    }

    const subtitlesToSave = (
      await Promise.all(
        seq.collect(textBasedSubs, async (subtitle) => {
          if (isUndefined(subtitle.index)) {
            return;
          }

          const filePath = getSubtitleCacheFilePath(program, subtitle);
          if (!filePath) {
            return;
          }

          const fullPath = path.join(cacheFolder, filePath);

          if (!(await fileExists(fullPath))) {
            return {
              subtitle,
              outPath: fullPath,
              tmpPath: await tmpName({ postfix: extname(filePath) }),
            };
          }
          this.logger.trace(
            'Skipping existing subtitle extraction (stream index = %d) path for program %s (%s). File already exists: %s',
            subtitle.index,
            program.id,
            program.title,
            fullPath,
          );
          return;
        }),
      )
    ).filter(isDefined);

    for (const { outPath } of subtitlesToSave) {
      const outDir = dirname(outPath);
      if (!(await fileExists(outDir))) {
        await fs.mkdir(outDir, { recursive: true });
      }
    }

    const subtitleOutputArgs = subtitlesToSave.reduce((prev, curr) => {
      const codec = curr.subtitle.codec === 'mov_text' ? 'text' : 'copy';
      prev.push(
        '-map',
        `0:${curr.subtitle.index}`,
        '-c:s',
        codec,
        `${curr.tmpPath}`,
      );
      return prev;
    }, [] as string[]);

    if (subtitlesToSave.length === 0) {
      this.logger.trace(
        'No subtitles to extract for program ID = %s',
        program.id,
      );
      return;
    }

    const outputResult = await Result.attemptAsync(async () => {
      return await new ChildProcessHelper().getStdout(
        ffmpegSetting.ffmpegExecutablePath,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'warning',
          ...(stream.get().streamSource.type === 'http'
            ? new HttpReconnectOptions().options()
            : []),
          '-i',
          `${stream.get().streamSource.path}`,
          ...subtitleOutputArgs,
        ],
        {
          swallowError: false,
          isPath: true,
          timeout: 500_000,
        },
      );
    });

    if (outputResult.isFailure()) {
      this.logger.warn(outputResult.error, 'Failed to extract subtitles');
      return;
    }

    const copyResults = await Promise.allSettled(
      subtitlesToSave.map(async ({ outPath, tmpPath }) => {
        return fs.cp(tmpPath, outPath);
      }),
    );

    for (const result of copyResults) {
      if (result.status === 'rejected') {
        this.logger.warn(result.reason, 'Failed to copy tmp subtitles');
      }
    }
  }
}
