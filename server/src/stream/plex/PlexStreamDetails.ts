import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { PlexMediaSource } from '@/db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { KEYS } from '@/types/inject.js';
import { Maybe, Nilable, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import {
  attempt,
  isDefined,
  isNonEmptyArray,
  isNonEmptyString,
} from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { seq } from '@tunarr/shared/util';
import {
  PlexEpisode,
  PlexMediaAudioStream,
  PlexMediaContainerResponseSchema,
  PlexMediaSubtitleStream,
  PlexMediaVideoStream,
  PlexMovie,
  PlexMusicTrack,
  isPlexMusicTrack,
  isTerminalItem,
} from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import {
  filter,
  find,
  first,
  isEmpty,
  isError,
  isNull,
  isUndefined,
  map,
  maxBy,
  round,
  sortBy,
  trimEnd,
} from 'lodash-es';
import { format } from 'node:util';
import { container } from '../../container.ts';
import { MinimalPlexBackedStreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import { MediaSourceType } from '../../db/schema/base.js';
import { GlobalScheduler } from '../../services/Scheduler.ts';
import { ReconcileProgramDurationsTask } from '../../tasks/ReconcileProgramDurationsTask.ts';
import { ReconcileProgramDurationsTaskFactory } from '../../tasks/TasksModule.ts';
import { WrappedError } from '../../types/errors.ts';
import { PlexT } from '../../types/internal.ts';
import { Result } from '../../types/result.ts';
import {
  ExternalStreamDetailsFetcher,
  StreamFetchRequest,
} from '../ExternalStreamDetailsFetcher.ts';
import { ExternalSubtitleDownloader } from '../ExternalSubtitleDownloader.ts';
import { PathCalculator } from '../PathCalculator.ts';
import {
  AudioStreamDetails,
  HttpStreamSource,
  ProgramStreamResult,
  StreamDetails,
  StreamSource,
  SubtitleStreamDetails,
  VideoStreamDetails,
} from '../types.ts';

/**
 * A 'new' version of the PlexTranscoder class that does not
 * invoke the transcoding on Plex at all. Instead, it gathers stream
 * metadata through standard Plex endpoints and always "direct plays" items,
 * leaving normalization up to the Tunarr FFMPEG pipeline.
 */
@injectable()
export class PlexStreamDetails extends ExternalStreamDetailsFetcher<PlexT> {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(ExternalSubtitleDownloader)
    private externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super();
  }

  async getStream({ server, lineupItem }: StreamFetchRequest<PlexT>) {
    return this.getStreamInternal(server, lineupItem);
  }

  private async getStreamInternal(
    server: PlexMediaSource,
    program: MinimalPlexBackedStreamLineupItem,
    depth: number = 0,
  ): Promise<Result<ProgramStreamResult>> {
    if (depth > 1) {
      return Result.failure(
        WrappedError.forMessage(
          'Exceeded maximum recursion depth when trying to find Plex item.',
        ),
      );
    }

    const plexExternalInfo = program.externalIds.find(
      (eid) => eid.sourceType === MediaSourceType.Plex,
    );
    if (!plexExternalInfo) {
      this.logger.error(
        'Could not find Plex external info for program ID %s',
        program.uuid,
      );
      return Result.failure(
        WrappedError.forMessage(
          format(
            'Could not find Plex external info for program ID %s',
            program.uuid,
          ),
        ),
      );
    }

    const plexApiClient =
      await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(server);

    const expectedItemType = program.type;
    const itemMetadataResult = await plexApiClient.getItemMetadata(
      program.externalKey,
    );

    if (itemMetadataResult.isFailure()) {
      if (itemMetadataResult.error.type === 'not_found') {
        this.logger.debug(
          'Could not find item %s in Plex. Rating key may have changed. Attempting to update.',
          program.externalKey,
        );
        const plexGuid = find(
          program.externalIds,
          (eid) => eid.sourceType === ProgramExternalIdType.PLEX_GUID,
        )?.externalKey;
        if (isNonEmptyString(plexGuid)) {
          const byGuidResult = await plexApiClient.doTypeCheckedGet(
            '/library/all',
            PlexMediaContainerResponseSchema,
            {
              params: {
                guid: plexGuid,
              },
            },
          );

          if (byGuidResult.isSuccess()) {
            if (byGuidResult.get().MediaContainer.size > 0) {
              this.logger.debug(
                'Found %d matching items in library. Using the first',
                byGuidResult.get().MediaContainer.size,
              );
              const metadata = first(
                byGuidResult.get().MediaContainer.Metadata,
              )!;

              const newRatingKey = metadata.ratingKey;
              this.logger.debug(
                'Updating program %s with new Plex rating key %s',
                program.uuid,
                newRatingKey,
              );

              await this.programDB.updateProgramPlexRatingKey(
                program.uuid,
                server.name,
                { externalKey: newRatingKey },
              );

              if (
                isTerminalItem(metadata) &&
                isDefined(metadata.duration) &&
                metadata.duration > 0 &&
                metadata.duration !== program.duration
              ) {
                await this.programDB.updateProgramDuration(
                  program.uuid,
                  metadata.duration,
                );

                const task =
                  container.get<ReconcileProgramDurationsTaskFactory>(
                    ReconcileProgramDurationsTask.KEY,
                  )({
                    type: 'program',
                    programId: program.uuid,
                  });

                GlobalScheduler.runTask(task);
              }

              return this.getStreamInternal(
                server,
                {
                  ...program,
                  externalKey: newRatingKey,
                },
                depth + 1,
              );
            } else {
              this.logger.debug(
                'Plex item with guid %s no longer in library',
                plexGuid,
              );
            }
          } else {
            this.logger.error(
              byGuidResult,
              'Error while querying Plex by GUID',
            );
          }
        }
      }
      // This will have to throw somewhere!
      return itemMetadataResult.recast();
    }

    const itemMetadata = itemMetadataResult.get();

    if (!isTerminalItem(itemMetadata)) {
      this.logger.warn(
        'Got unexpected item type %s from Plex (ID = %s) when starting stream. Expected item type %s',
        itemMetadata.type,
        program.externalKey,
        expectedItemType,
      );
      return Result.failure('');
    }

    const details = await this.getItemStreamDetails(
      program,
      itemMetadata,
      plexApiClient,
    );

    if (isNull(details)) {
      return Result.failure('Could got not get item stream details');
    }

    if (
      isNonEmptyString(details.serverPath) &&
      details.serverPath !== plexExternalInfo.externalFilePath
    ) {
      this.programDB
        .updateProgramPlexRatingKey(program.uuid, server.uuid, {
          externalKey: program.externalKey,
          externalFilePath: details.serverPath,
          directFilePath: details.directFilePath ?? null,
        })
        .catch((err) => {
          this.logger.error(
            err,
            'Error while updating Plex file path for program %s',
            program.uuid,
          );
        });
    }

    const filePath =
      details.directFilePath ?? first(first(itemMetadata.Media)?.Part)?.file;
    const streamSource = await this.getStreamSource(
      server,
      filePath,
      details.serverPath ?? plexExternalInfo.externalFilePath,
    );

    return Result.success({
      streamSource,
      streamDetails: details,
    });
  }

  private async getStreamSource(
    server: PlexMediaSource,
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
      serverPath = serverPath.startsWith('/') ? serverPath : `/${serverPath}`;
      this.logger.debug(
        'Did not find Plex file on disk relative to Tunarr. Using network path: %s',
        serverPath,
      );

      return new HttpStreamSource(
        `${trimEnd(server.uri, '/')}${serverPath}?X-Plex-Token=${
          server.accessToken
        }`,
      );
    } else {
      throw new Error('Could not resolve stream URL');
    }
  }

  private async getItemStreamDetails(
    item: MinimalPlexBackedStreamLineupItem,
    media: PlexMovie | PlexEpisode | PlexMusicTrack,
    plexApiClient: PlexApiClient,
  ): Promise<Nullable<StreamDetails>> {
    const relevantMedia = maxBy(
      filter(media.Media, (m) => (m.Part?.length ?? 0) > 0) ?? [],
      (m) => m.id,
    );
    const relevantPart = first(relevantMedia?.Part);
    const mediaStreams = relevantPart?.Stream;

    if (isUndefined(mediaStreams)) {
      this.logger.error(
        'Could not extract a stream for Plex item ID = %s',
        item.externalKey,
      );
    }

    const videoStream = find(
      mediaStreams,
      (stream): stream is PlexMediaVideoStream => stream.streamType === 1,
    );

    const audioStream = find(
      mediaStreams,
      (stream): stream is PlexMediaAudioStream =>
        stream.streamType === 2 && !!stream.selected,
    );

    const audioOnly = isUndefined(videoStream) && !isUndefined(audioStream);

    let videoDetails: Maybe<VideoStreamDetails>;
    if (videoStream) {
      videoDetails = {
        sampleAspectRatio: isNonEmptyString(videoStream?.pixelAspectRatio)
          ? videoStream.pixelAspectRatio
          : '1:1',
        scanType:
          videoStream.scanType === 'interlaced'
            ? 'interlaced'
            : videoStream.scanType === 'progressive'
              ? 'progressive'
              : 'unknown',
        width: videoStream.width,
        height: videoStream.height,
        framerate: videoStream.frameRate,
        displayAspectRatio:
          (relevantMedia?.aspectRatio ?? 0) === 0
            ? ''
            : round(relevantMedia?.aspectRatio ?? 0.0, 10).toFixed(),
        // chapters
        anamorphic:
          videoStream.anamorphic === '1' || videoStream.anamorphic === true,
        bitDepth: videoStream.bitDepth,
        bitrate: videoStream.bitrate,
        codec: videoStream.codec,
        profile: videoStream.profile?.toLowerCase(),
        streamIndex: videoStream.index,
      } satisfies VideoStreamDetails;
    }

    const audioStreamDetails = map(
      sortBy(
        filter(mediaStreams, (stream): stream is PlexMediaAudioStream => {
          return stream.streamType === 2;
        }),
        (stream) => [
          stream.selected ? -1 : 0,
          stream.default ? 0 : 1,
          stream.index,
        ],
      ),
      (audioStream) => {
        return {
          bitrate: audioStream.bitrate,
          channels: audioStream.channels,
          codec: audioStream.codec,
          index: audioStream.index,
          // Use the "selected" bit over the "default" if it exists
          // In plex, selected signifies that the user's preferences would choose
          // this stream over others, even if it is not the default
          // This is temporary until we have language preferences within Tunarr
          // to pick these streams.
          selected: audioStream.selected,
          default: audioStream.default,
          language: audioStream.language,
          languageCodeISO6391: audioStream.languageTag,
          languageCodeISO6392: audioStream.languageCode,
          title: audioStream.displayTitle,
        } satisfies AudioStreamDetails;
      },
    );

    const subtitleStreamDetails = await seq.asyncCollect(
      sortBy(
        filter(mediaStreams, (stream): stream is PlexMediaSubtitleStream => {
          return stream.streamType === 3;
        }),
        (stream) => [
          stream.selected ? -1 : 0,
          // stream.default ? 0 : 1,
          stream.index,
        ],
      ),
      async (stream) => {
        const sdh = !![
          stream.title,
          stream.displayTitle,
          stream.extendedDisplayTitle,
        ]
          .filter(isNonEmptyString)
          .find((s) => s.toLocaleLowerCase().includes('sdh'));
        const details = {
          type: isDefined(stream.index) ? 'embedded' : 'external',
          codec: stream.codec.toLocaleLowerCase(),
          default: stream.default ?? false,
          index: stream.index,
          title: stream.displayTitle,
          description: stream.extendedDisplayTitle,
          sdh,
          path: stream.key ? plexApiClient.getFullUrl(stream.key) : undefined,
          languageCodeISO6391: stream.languageTag,
          languageCodeISO6392: stream.languageCode,
          forced: stream.forced ?? false,
        } satisfies SubtitleStreamDetails;

        if (details.type === 'external' && isNonEmptyString(stream.key)) {
          const key = stream.key;
          const fullPath =
            await this.externalSubtitleDownloader.downloadSubtitlesIfNecessary(
              item,
              details,
              () => plexApiClient.getSubtitles(key),
            );

          if (fullPath) {
            details.path = fullPath;
            return details;
          }

          this.logger.warn(
            'Skipping external subtitles at index %d because download failed. Please check logs and file an issue for assistance.',
          );

          return;
        }

        return details;
      },
    );

    const streamDetails: StreamDetails = {
      serverPath: relevantPart?.key,
      directFilePath: relevantPart?.file,
      videoDetails: videoDetails ? [videoDetails] : undefined,
      audioDetails: isNonEmptyArray(audioStreamDetails)
        ? audioStreamDetails
        : undefined,
      subtitleDetails: isNonEmptyArray(subtitleStreamDetails)
        ? subtitleStreamDetails
        : undefined,
      duration: dayjs.duration(item.duration),
    };

    if (
      isUndefined(streamDetails.videoDetails) &&
      isUndefined(streamDetails.audioDetails)
    ) {
      this.logger.warn(
        'Could not find a video nor audio stream for Plex item %s',
        item.externalKey,
      );
      return null;
    }

    if (audioOnly) {
      // TODO Use our proxy endpoint here
      const placeholderThumbPath = isPlexMusicTrack(media)
        ? (media.parentThumb ?? media.grandparentThumb ?? media.thumb)
        : media.thumb;

      // We have to check that we can hit this URL or the stream will not work
      if (isNonEmptyString(placeholderThumbPath)) {
        const result = await attempt(() =>
          plexApiClient.doHead({ url: placeholderThumbPath }),
        );
        if (!isError(result)) {
          streamDetails.placeholderImage = new HttpStreamSource(
            plexApiClient.getFullUrl(placeholderThumbPath),
          );
        }
      }

      if (isEmpty(streamDetails.placeholderImage)) {
        streamDetails.placeholderImage = new HttpStreamSource(
          makeLocalUrl('/images/generic-music-screen.png'),
        );
      }
    }

    streamDetails.audioOnly = audioOnly;

    return streamDetails;
  }

  // private getPlexTranscodeStreamUrl(key: string) {
  //   const query = querystring.encode({
  //     ...DefaultPlexHeaders,
  //     'X-Plex-Token': this.server.accessToken,
  //     Connection: 'keep-alive',
  //     path: key,
  //     mediaIndex: 0,
  //     partIndex: 0,
  //     fastSeek: 1,
  //     directPlay: true,
  //     directStream: true,
  //     directStreamAudio: true,
  //     copyts: false,
  //   });

  //   return `${trimEnd(
  //     this.server.uri,
  //     '/',
  //   )}/video/:/transcode/universal/start.m3u8?${query}`;
  // }
}
