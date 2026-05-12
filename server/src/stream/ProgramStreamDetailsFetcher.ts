import { nullToUndefined } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { groupBy, head, isEmpty, mapValues, orderBy } from 'lodash-es';
import path from 'node:path';
import { match } from 'ts-pattern';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Nilable } from '../types/util.ts';
import { fileExists } from '../util/fsUtil.ts';
import { isNonEmptyArray, isNonEmptyString } from '../util/index.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { StreamFetchRequest } from './ExternalStreamDetailsFetcher.ts';
import { PathCalculator } from './PathCalculator.ts';
import {
  AudioStreamDetails,
  HttpStreamSource,
  ProgramStreamResult,
  StreamDetails,
  StreamSource,
  SubtitleStreamDetails,
  VideoStreamDetails,
} from './types.ts';
import { extractIsAnamorphic } from './util.ts';

@injectable()
export class ProgramStreamDetailsFetcher {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(@inject(KEYS.ProgramDB) private programDB: IProgramDB) {}

  async getStream({
    lineupItem,
    server,
  }: StreamFetchRequest): Promise<Result<ProgramStreamResult>> {
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
        new Error(`Program with ID ${lineupItem.uuid} Has no media versions.`),
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
            pixelFormat: nullToUndefined(videoStream.pixelFormat),
            bitrate: undefined,
            isAttachedPic: false,
            colorRange: videoStream.colorRange ?? undefined,
            colorSpace: videoStream.colorSpace ?? undefined,
            colorTransfer: videoStream.colorTransfer ?? undefined,
            colorPrimaries: videoStream.colorPrimaries ?? undefined,
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

    if (server.type === 'local') {
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
    } else {
      const filePath = head(firstVersion.mediaFiles)?.path;
      const serverPath = // details.serverPath ??
        program.externalIds.find(
          (eid) => eid.sourceType === server.type,
        )?.externalFilePath;
      const streamSource = await this.getStreamSource(
        server,
        filePath,
        serverPath,
      );
      return Result.success({ streamDetails, streamSource });
    }
  }

  private async getStreamSource(
    server: MediaSourceWithRelations,
    potentialFilePath: Nilable<string>,
    serverPath: Nilable<string>,
  ): Promise<StreamSource> {
    if (isNonEmptyString(potentialFilePath)) {
      if (await fileExists(potentialFilePath)) {
        this.logger.debug(
          'Found item locally at path reported by server, playing from disk. Path: %s',
          potentialFilePath,
        );
        return {
          type: 'file',
          path: potentialFilePath,
        };
      } else {
        const replacedPath = await PathCalculator.findFirstValidPath(
          potentialFilePath,
          server.replacePaths,
        );
        if (replacedPath) {
          this.logger.debug(
            'Found valid path replacement, playing from disk. Original path: "%s" Replace path: "%s',
            potentialFilePath,
            replacedPath,
          );
          return {
            type: 'file',
            path: replacedPath,
          };
        }
      }
    }

    if (isNonEmptyString(serverPath)) {
      this.logger.debug(
        'Did not find %s file on disk relative to Tunarr. Using network path: %s',
        server.type,
        serverPath,
      );

      return match(server)
        .with(
          { type: 'plex' },
          (server) =>
            new HttpStreamSource(
              `${path.join(server.uri, serverPath)}?X-Plex-Token=${
                server.accessToken
              }`,
            ),
        )
        .with(
          { type: 'jellyfin' },
          (server) =>
            new HttpStreamSource(
              `${path.join(server.uri, 'Videos', serverPath, 'stream')}?static=true`,
              {
                'X-Emby-Token': server.accessToken,
              },
            ),
        )
        .with(
          { type: 'emby' },
          (server) =>
            new HttpStreamSource(
              `${path.join(server.uri, 'Videos', serverPath, 'stream')}?X-Emby-Token=${
                server.accessToken
              }&static=true`,
            ),
        )
        .with({ type: 'local' }, () => {
          throw new Error(`Remote paths are not supported for local media`);
        })
        .exhaustive();
    } else {
      throw new Error('Could not resolve stream URL');
    }
  }
}
