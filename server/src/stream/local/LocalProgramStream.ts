import dayjs from 'dayjs';
import { head, isUndefined } from 'lodash-es';
import { isLocalBackedLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import type { OutputFormat } from '../../ffmpeg/builder/constants.ts';
import type { StreamOptions } from '../../ffmpeg/ffmpegBase.ts';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.ts';
import type { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.ts';
import type { CacheImageService } from '../../services/cacheImageService.ts';
import { Result } from '../../types/result.ts';
import type { PlayerContext } from '../PlayerStreamContext.ts';
import { ProgramStream } from '../ProgramStream.ts';

import type { interfaces } from 'inversify';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceType } from '../../db/schema/base.ts';
import { GenericNotFoundError } from '../../types/errors.ts';
import type { LocalProgramStreamDetails } from './LocalProgramStreamDetails.ts';

export class LocalProgramStream extends ProgramStream {
  private killed = false;

  constructor(
    settingsDB: ISettingsDB,
    cacheImageService: CacheImageService,
    ffmpegFactory: FFmpegFactory,
    private mediaSourceDB: MediaSourceDB,
    private programDB: IProgramDB,
    private streamDetailsFactory: interfaces.AutoFactory<LocalProgramStreamDetails>,
    context: PlayerContext,
    outputFormat: OutputFormat,
  ) {
    super(context, outputFormat, settingsDB, cacheImageService, ffmpegFactory);
  }

  protected shutdownInternal() {
    super.shutdownInternal();
    this.killed = true;
  }

  protected async setupInternal(
    opts?: Partial<StreamOptions>,
  ): Promise<Result<FfmpegTranscodeSession>> {
    const lineupItem = this.context.lineupItem;
    if (!isLocalBackedLineupItem(lineupItem)) {
      return Result.forError(
        new Error(
          'Lineup item is not a content item: ' + JSON.stringify(lineupItem),
        ),
      );
    }

    const start = dayjs.duration(lineupItem.startOffset ?? 0);

    const ffmpeg = this.ffmpegFactory(
      this.context.transcodeConfig,
      this.context.sourceChannel,
      this.context.streamMode,
    );

    if (this.killed) {
      return Result.forError(new Error('Stream was killed already, returning'));
    }

    const program = await this.programDB.getProgramById(
      lineupItem.program.uuid,
    );

    if (!program) {
      return Result.forError(
        new Error(
          `Could not find program with ID ${lineupItem.program.uuid} when trying to start stream! This is bad!`,
        ),
      );
    }

    const firstVersion = head(program.versions);

    if (!firstVersion) {
      // TODO: Backfill these on the spot
      return Result.forError(
        new Error(
          `Program with ID ${lineupItem.program.uuid} Has no media versions.`,
        ),
      );
    }

    const mediaSource = await this.mediaSourceDB.findByType(
      MediaSourceType.Local,
      lineupItem.program.mediaSourceId,
    );
    if (!mediaSource) {
      return Result.forError(
        new GenericNotFoundError(
          lineupItem.program.mediaSourceId,
          'media_source',
        ),
      );
    }

    const streamResult = await this.streamDetailsFactory().getStream({
      server: mediaSource,
      lineupItem: lineupItem.program,
    });
    if (streamResult.isFailure()) {
      return streamResult.recast();
    }

    const { streamDetails: details, streamSource: source } = streamResult.get();

    const ffmpegOutStream = await ffmpeg.createStreamSession({
      stream: {
        source,
        details,
      },
      options: {
        startTime: start,
        duration: dayjs.duration(lineupItem.streamDuration),
        watermark: await this.getWatermark(),
        realtime: this.context.realtime,
        extraInputHeaders: {},
        outputFormat: this.outputFormat,
        streamMode: this.context.streamMode,
        ...(opts ?? {}),
      },
      lineupItem,
    });

    if (isUndefined(ffmpegOutStream)) {
      return Result.forError(new Error('Unable to spawn ffmpeg'));
    }

    return Result.success(ffmpegOutStream);
  }
}
