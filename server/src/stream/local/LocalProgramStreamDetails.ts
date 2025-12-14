import { nullToUndefined } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { groupBy, head, isEmpty, mapValues, orderBy } from 'lodash-es';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.ts';
import { isNonEmptyArray } from '../../util/index.ts';
import {
  ExternalStreamDetailsFetcher,
  StreamFetchRequest,
} from '../ExternalStreamDetailsFetcher.ts';
import { extractIsAnamorphic } from '../jellyfin/JellyfinStreamDetails.ts';
import {
  AudioStreamDetails,
  ProgramStreamResult,
  StreamDetails,
  StreamSource,
  SubtitleStreamDetails,
  VideoStreamDetails,
} from '../types.ts';

@injectable()
export class LocalProgramStreamDetails extends ExternalStreamDetailsFetcher<'local'> {
  constructor(@inject(KEYS.ProgramDB) private programDB: IProgramDB) {
    super();
  }

  async getStream({
    lineupItem,
  }: StreamFetchRequest<'local'>): Promise<Result<ProgramStreamResult>> {
    const program = await this.programDB.getProgramById(lineupItem.uuid);

    if (!program) {
      return Result.forError(
        new Error(
          `Could not find program with ID ${lineupItem.uuid} when trying to start stream! This is bad!`,
        ),
      );
    }

    const firstVersion = head(program.versions);

    if (!firstVersion) {
      // TODO: Backfill these on the spot
      return Result.forError(
        new Error(`Program with ID ${program.uuid} Has no media versions.`),
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

    const subtitleStreamDetails =
      streamsByType['subtitles']?.map(
        (subtitle): SubtitleStreamDetails => ({
          codec: subtitle.codec,
          default: subtitle.default,
          forced: subtitle.forced,
          sdh: false, // TODO:
          type: 'embedded',
          index: subtitle.index,
          languageCodeISO6392: nullToUndefined(subtitle.language),
        }),
      ) ?? ([] as SubtitleStreamDetails[]);

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
    return Result.success({ streamDetails, streamSource });
  }
}
