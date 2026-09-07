import { nullToUndefined, seq } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { head, isEmpty, orderBy, trimEnd, trimStart } from 'lodash-es';
import { match } from 'ts-pattern';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Maybe, Nilable } from '../types/util.ts';
import { fileExists } from '../util/fsUtil.ts';
import {
  groupByTyped,
  isNonEmptyArray,
  isNonEmptyString,
} from '../util/index.ts';
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

    const streamsByType = groupByTyped(
      firstVersion.mediaStreams ?? [],
      (stream) => stream.streamKind,
    );
    for (const [streamType, streams] of streamsByType.entries()) {
      streamsByType.set(
        streamType,
        orderBy(streams, (stream) => stream.index, 'asc'),
      );
    }

    const displayAspectRatio =
      firstVersion.displayAspectRatio ??
      `${firstVersion.width}/${firstVersion.height}`;
    const videoStreamDetails =
      streamsByType.get('video')?.map(
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
      streamsByType.get('audio')?.map(
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

    // NOTE: 'external_subtitles' media streams are deliberately not included
    // here. They carry no path (program_media_stream has no such column) and
    // their index is relative to the container, so they are not addressable as
    // an ffmpeg input. Every external subtitle is also recorded as a 'sidecar'
    // row on program_subtitles, which does have a path, and those are handled
    // below.
    const subtitleStreamDetails: SubtitleStreamDetails[] =
      streamsByType.get('subtitles')?.map(
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

    const usableSubtitles = await Promise.all(
      (program.subtitles ?? []).map(async (subtitle) => {
        let pathOnDisk: Maybe<string>;
        if (
          isNonEmptyString(subtitle.path) &&
          (await fileExists(subtitle.path))
        ) {
          pathOnDisk = subtitle.path;
        }

        if (subtitle.subtitleType === 'sidecar') {
          // External subtitles are always handed to ffmpeg as a local file:
          // either a sidecar from a local library, a copy downloaded during
          // scanning, or a file on storage Tunarr shares with the media source.
          if (pathOnDisk) {
            return { subtitle, path: pathOnDisk };
          }

          // Re-checked here rather than trusting the scan, so a mount that
          // appeared later is picked up without a rescan.
          const sharedPath = await PathCalculator.findLocalPath(
            subtitle.sourcePath,
            server.replacePaths,
          );
          if (sharedPath) {
            return { subtitle, path: sharedPath };
          }

          this.logger.debug(
            'Dropping sidecar subtitle %s for program %s: not on disk (%s) and not on shared storage (%s). It should be downloaded on the next scan of this library.',
            subtitle.uuid,
            program.uuid,
            subtitle.path ?? '<no path>',
            subtitle.sourcePath ?? '<no source path>',
          );
          return null;
        }

        if (!subtitle.isExtracted) {
          return null;
        }
        if (!pathOnDisk) {
          this.logger.debug(
            'Clearing isExtracted flag for program %s subtitle %s: file missing on disk (%s)',
            program.uuid,
            subtitle.uuid,
            subtitle.path ?? '<no path>',
          );
          await this.programDB.clearExtractedSubtitle(subtitle.uuid);
          return null;
        }
        return { subtitle, path: pathOnDisk };
      }),
    );

    subtitleStreamDetails.push(
      ...seq.collect(usableSubtitles, (usable) => {
        if (!usable) return null;
        const { subtitle, path } = usable;
        return {
          ...subtitle,
          index: nullToUndefined(subtitle.streamIndex),
          type: subtitle.subtitleType === 'embedded' ? 'embedded' : 'external',
          languageCodeISO6392: subtitle.language,
          sdh: subtitle.sdh,
          path,
        } satisfies SubtitleStreamDetails;
      }),
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
              `${trimEnd(server.uri, '/')}/${trimStart(serverPath, '/')}?X-Plex-Token=${
                server.accessToken
              }`,
            ),
        )
        .with(
          { type: 'jellyfin' },
          (server) =>
            new HttpStreamSource(
              `${trimEnd(server.uri, '/')}/Videos/${trimStart(serverPath, '/')}/stream?static=true`,
              {
                'X-Emby-Token': server.accessToken,
              },
            ),
        )
        .with(
          { type: 'emby' },
          (server) =>
            new HttpStreamSource(
              `${trimEnd(server.uri, '/')}/Videos/${trimStart(serverPath, '/')}/stream?X-Emby-Token=${
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
