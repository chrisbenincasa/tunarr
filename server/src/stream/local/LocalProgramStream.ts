import { nullToUndefined } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import {
  groupBy,
  head,
  isEmpty,
  isUndefined,
  mapValues,
  orderBy,
} from 'lodash-es';
import { isContentBackedLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import type { OutputFormat } from '../../ffmpeg/builder/constants.ts';
import type { StreamOptions } from '../../ffmpeg/ffmpegBase.ts';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.ts';
import type { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.ts';
import type { CacheImageService } from '../../services/cacheImageService.ts';
import { Result } from '../../types/result.ts';
import { isNonEmptyArray } from '../../util/index.ts';
import { extractIsAnamorphic } from '../jellyfin/JellyfinStreamDetails.ts';
import type { PlayerContext } from '../PlayerStreamContext.ts';
import { ProgramStream } from '../ProgramStream.ts';
import type {
  AudioStreamDetails,
  StreamDetails,
  StreamSource,
  SubtitleStreamDetails,
  VideoStreamDetails,
} from '../types.ts';

export class LocalProgramStream extends ProgramStream {
  private killed = false;

  constructor(
    settingsDB: ISettingsDB,
    cacheImageService: CacheImageService,
    ffmpegFactory: FFmpegFactory,
    private programDB: IProgramDB,
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
    if (!isContentBackedLineupItem(lineupItem)) {
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

    const streamsByType = mapValues(
      groupBy(firstVersion.mediaStreams ?? [], (stream) => stream.streamKind),
      (streams) => orderBy(streams, (stream) => stream.index, 'asc'),
    );

    const displayAspectRatio =
      firstVersion.displayAspectRatio ??
      `${firstVersion.width}/${firstVersion.height}`;
    const videoStreamDetails =
      streamsByType['video']?.map(
        (videoStream) =>
          ({
            displayAspectRatio,
            height: firstVersion.height,
            sampleAspectRatio: nullToUndefined(firstVersion.sampleAspectRatio),
            width: firstVersion.width,
            anamorphic: extractIsAnamorphic(
              firstVersion.width,
              firstVersion.height,
              displayAspectRatio,
            ),
            bitDepth: nullToUndefined(videoStream.bitsPerSample),
            codec: videoStream.codec,
            framerate: nullToUndefined(firstVersion.frameRate),
            profile: nullToUndefined(videoStream.profile),
            scanType: nullToUndefined(firstVersion.scanKind),
            streamIndex: videoStream.index,
          }) satisfies VideoStreamDetails,
      ) ?? [];

    const audioStreamDetails =
      streamsByType['audio']?.map(
        (audioStream) =>
          ({
            channels: nullToUndefined(audioStream.channels),
            codec: audioStream.codec,
            default: audioStream.default,
            forced: audioStream.forced,
            index: audioStream.index,
            languageCodeISO6392: nullToUndefined(audioStream.language),
            profile: nullToUndefined(audioStream.profile),
            title: nullToUndefined(audioStream.title),
          }) satisfies AudioStreamDetails,
      ) ?? [];

    const subtitleStreamDetails: SubtitleStreamDetails[] =
      streamsByType['subtitles']?.map(
        (subtitle) =>
          ({
            codec: subtitle.codec,
            default: subtitle.default,
            forced: subtitle.forced,
            sdh: false, // TODO:
            type: 'embedded',
            index: subtitle.index,
            languageCodeISO6392: nullToUndefined(subtitle.language),
          }) satisfies SubtitleStreamDetails,
      ) ?? [];

    subtitleStreamDetails.push(
      ...(program.subtitles
        ?.filter((subtitle) => subtitle.isExtracted)
        .map(
          (subtitle) =>
            ({
              ...subtitle,
              index: nullToUndefined(subtitle.streamIndex),
              type:
                subtitle.subtitleType === 'embedded' ? 'embedded' : 'external',
              languageCodeISO6392: subtitle.language,
              sdh: subtitle.sdh,
              path: nullToUndefined(subtitle.path),
            }) satisfies SubtitleStreamDetails,
        ) ?? []),
    );

    const streamDetails: StreamDetails = {
      audioDetails: isNonEmptyArray(audioStreamDetails)
        ? audioStreamDetails
        : undefined,
      audioOnly: isEmpty(videoStreamDetails) && !isEmpty(audioStreamDetails),
      chapters: firstVersion.chapters,
      duration: dayjs.duration(firstVersion.duration),
      subtitleDetails: isNonEmptyArray(subtitleStreamDetails)
        ? subtitleStreamDetails
        : undefined,
      videoDetails: isNonEmptyArray(videoStreamDetails)
        ? videoStreamDetails
        : undefined,
    };

    const file = head(firstVersion.mediaFiles);

    if (!file) {
      return Result.forError(
        new Error(`Program ID has no media files: ${program.uuid}`),
      );
    }

    const streamSource: StreamSource = {
      type: 'file',
      path: file.path,
    };

    const ffmpegOutStream = await ffmpeg.createStreamSession({
      stream: {
        source: streamSource,
        details: streamDetails,
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
