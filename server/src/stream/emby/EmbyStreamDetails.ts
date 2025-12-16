import type { StreamLineupProgram } from '@/db/derived_types/StreamLineup.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe, Nilable, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { seq } from '@tunarr/shared/util';
import { type EmbyItem } from '@tunarr/types/emby';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import {
  attempt,
  filter,
  find,
  first,
  isEmpty,
  isError,
  isNil,
  isNull,
  isUndefined,
  orderBy,
  sortBy,
  takeWhile,
  trim,
  trimEnd,
} from 'lodash-es';
import util from 'node:util';
import { type NonEmptyArray } from 'ts-essentials';
import { MediaSourceType } from '../../db/schema/base.ts';
import {
  MediaSourceWithRelations,
  SpecificProgramSourceOrmType,
} from '../../db/schema/derivedTypes.js';
import type { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { WrappedError } from '../../types/errors.ts';
import { EmbyT } from '../../types/internal.ts';
import { Result } from '../../types/result.ts';
import {
  ifDefined,
  isDefined,
  isNonEmptyArray,
  isNonEmptyString,
  nullToUndefined,
} from '../../util/index.ts';
import {
  ExternalStreamDetailsFetcher,
  StreamFetchRequest,
} from '../ExternalStreamDetailsFetcher.ts';
import { ExternalSubtitleDownloader } from '../ExternalSubtitleDownloader.ts';
import { PathCalculator } from '../PathCalculator.ts';
import {
  type AudioStreamDetails,
  HttpStreamSource,
  type ProgramStreamResult,
  type StreamDetails,
  type StreamSource,
  SubtitleStreamDetails,
  type VideoStreamDetails,
} from '../types.ts';

// TODO: this is basically an exact copy of the Jellyfin one, can we consolidate?
@injectable()
export class EmbyStreamDetails extends ExternalStreamDetailsFetcher<EmbyT> {
  private emby: EmbyApiClient;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(ExternalSubtitleDownloader)
    private externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super();
  }

  async getStream({ server, lineupItem }: StreamFetchRequest<EmbyT>) {
    return this.getStreamInternal(server, lineupItem);
  }

  private async getStreamInternal(
    mediaSource: MediaSourceWithRelations,
    program: SpecificProgramSourceOrmType<EmbyT, StreamLineupProgram>,
    depth: number = 0,
  ): Promise<Result<ProgramStreamResult>> {
    if (depth > 1) {
      return Result.failure(
        WrappedError.forMessage(
          'Exceeded maximum recursion depth when trying to find Plex item.',
        ),
      );
    }

    this.emby =
      await this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
        mediaSource,
      );

    const itemMetadataResult = await this.emby.getItem(program.externalKey);

    if (itemMetadataResult.isFailure()) {
      this.logger.error(itemMetadataResult.error, 'Error getting Emby stream');
      return itemMetadataResult.recast();
    }

    const itemMetadata = itemMetadataResult.get();

    if (isUndefined(itemMetadata)) {
      this.logger.error(
        'Emby item with ID %s does not exist. Underlying file might have changed.',
        program.externalKey,
      );
      // const newExternalId =
      //   await this.jellyfinItemFinder.findForProgramAndUpdate(item.programId);

      // if (newExternalId) {
      //   return this.getStreamInternal(
      //     mediaSource,
      //     {
      //       ...item,
      //       ...newExternalId,
      //     },
      //     depth + 1,
      //   );
      // }

      return Result.failure(
        util.format(
          'Emby item with ID %s does not exist. Underlying file might have changed.',
          program.externalKey,
        ),
      );
    }

    const details = await this.getItemStreamDetails(program, itemMetadata);

    if (isNull(details)) {
      return Result.failure('Could not find a media source for Emby item.');
    }

    const filePath =
      details.directFilePath ?? first(itemMetadata?.MediaSources)?.Path;
    const serverPath =
      details.serverPath ??
      program.externalIds.find((eid) => eid.sourceType === MediaSourceType.Emby)
        ?.externalFilePath;
    const streamSource: StreamSource = await this.getStreamSource(
      mediaSource,
      filePath,
      serverPath,
    );

    return Result.success({
      streamSource,
      streamDetails: details,
    });
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
      serverPath = trim(serverPath, '/');
      this.logger.debug(
        'Did not find Emby file on disk relative to Tunarr. Using network path: %s',
        serverPath,
      );

      return new HttpStreamSource(
        `${trimEnd(server.uri, '/')}/Videos/${serverPath}/stream?X-Emby-Token=${
          server.accessToken
        }&static=true`,
      );
    } else {
      throw new Error('Could not resolve stream URL');
    }
  }

  private async getItemStreamDetails(
    item: SpecificProgramSourceOrmType<EmbyT, StreamLineupProgram>,
    media: EmbyItem,
  ): Promise<Nullable<StreamDetails>> {
    const firstMediaSource = first(media.MediaSources);

    if (!firstMediaSource) {
      return null;
    }

    // Emby orders media streams with external ones first
    // We count these and then use the count as the offset for the
    // actual indexes of the embedded streams.
    const externalStreamCount = takeWhile(
      firstMediaSource?.MediaStreams,
      (s) => s.IsExternal,
    ).length;

    const videoStream = find(
      firstMediaSource?.MediaStreams,
      (stream) => stream.Type === 'Video',
    );

    // Video
    let videoStreamDetails: Maybe<VideoStreamDetails>;
    if (isDefined(videoStream)) {
      const isAnamorphic =
        (videoStream.IsAnamorphic ??
        (isNonEmptyString(videoStream.AspectRatio) &&
          videoStream.AspectRatio.includes(':')))
          ? extractIsAnamorphic(
              videoStream.Width ?? 1,
              videoStream.Height ?? 1,
              videoStream.AspectRatio!,
            )
          : false;

      videoStreamDetails = {
        width: videoStream.Width ?? 1,
        height: videoStream.Height ?? 1,
        anamorphic: isAnamorphic,
        displayAspectRatio: isNonEmptyString(videoStream.AspectRatio)
          ? videoStream.AspectRatio
          : '',
        scanType: videoStream.IsInterlaced ? 'interlaced' : 'progressive',
        framerate: videoStream.RealFrameRate ?? undefined,
        streamIndex:
          ifDefined(videoStream.Index, (streamIndex) => {
            const index = streamIndex - externalStreamCount;
            if (index >= 0) {
              return index;
            }
            return;
          }) ?? undefined,
        sampleAspectRatio: isAnamorphic ? '0:0' : '1:1',
        bitDepth: videoStream.BitDepth ?? undefined,
        bitrate: videoStream.BitRate ?? undefined,
        codec: videoStream.Codec ?? undefined,
        profile: videoStream.Profile?.toLowerCase(),
        pixelFormat: videoStream.PixelFormat ?? undefined,
      };
    }

    const audioStreamDetails = seq.collect(
      sortBy(
        filter(
          firstMediaSource?.MediaStreams,
          (stream) => stream.Type === 'Audio',
        ),
        (stream) => [stream.Index ?? 0, !stream.IsDefault],
      ),
      (audioStream) => {
        if (isNil(audioStream.Index)) {
          return;
        }
        const index = audioStream.Index - externalStreamCount;
        if (index < 0) {
          return;
        }
        return {
          bitrate: nullToUndefined(audioStream.BitRate),
          channels: nullToUndefined(audioStream.Channels),
          codec: nullToUndefined(audioStream.Codec),
          default: !!audioStream.IsDefault,
          forced: audioStream.IsForced,
          index,
          language: nullToUndefined(audioStream.Language),
          profile: nullToUndefined(audioStream.Profile),
          title: nullToUndefined(audioStream.Title),
          languageCodeISO6392: nullToUndefined(audioStream.Language),
        } satisfies AudioStreamDetails;
      },
    );

    const subtitleStreamDetails = await seq.asyncCollect(
      orderBy(
        filter(
          firstMediaSource?.MediaStreams,
          (stream) => stream.Type === 'Subtitle',
        ),
        [(stream) => stream.Index ?? 0, (stream) => !stream.IsDefault],
      ),
      async (subtitleStream) => {
        let index: Maybe<number> = undefined;
        if (isDefined(subtitleStream.Index)) {
          if (subtitleStream.IsExternal) {
            index = subtitleStream.Index;
          } else {
            const streamRelativeIndex =
              subtitleStream.Index - externalStreamCount;
            if (streamRelativeIndex >= 0) {
              index = streamRelativeIndex;
            }
          }
        }

        const details = {
          codec: subtitleStream.Codec?.toLowerCase() ?? 'unknown',
          default: subtitleStream.IsDefault ?? false,
          forced: subtitleStream.IsForced ?? false,
          sdh: subtitleStream.IsHearingImpaired ?? false,
          type: subtitleStream.IsExternal ? 'external' : 'embedded',
          description: subtitleStream.Title ?? '',
          index,
          languageCodeISO6392: subtitleStream.Language ?? undefined,
          path: subtitleStream.Path ?? undefined,
          title: subtitleStream.DisplayTitle ?? undefined,
        } satisfies SubtitleStreamDetails;

        if (details.type === 'external' && isDefined(index)) {
          const fullPath =
            await this.externalSubtitleDownloader.downloadSubtitlesIfNecessary(
              item,
              details,
              ({ extension: ext }) =>
                this.emby.getSubtitles(
                  item.externalKey,
                  firstMediaSource.Id!,
                  index,
                  ext,
                ),
            );

          if (fullPath) {
            details.path = fullPath;
          }
        }

        return details;
      },
    );

    if (!videoStreamDetails && isEmpty(audioStreamDetails)) {
      this.logger.warn(
        'Could not find a video nor audio stream for Plex item %s',
        item.externalKey,
      );
      return null;
    }

    const audioOnly = !videoStreamDetails && !isEmpty(audioStreamDetails);

    let serverPath = nullToUndefined(firstMediaSource?.Id);
    if (
      isNonEmptyString(serverPath) &&
      serverPath.toLowerCase().startsWith('mediasource_')
    ) {
      // For "remote" media (in the eyes of Emby) use the ID itself.
      serverPath = media.Id;
    }

    const streamDetails: StreamDetails = {
      serverPath,
      directFilePath: nullToUndefined(firstMediaSource?.Path),
      videoDetails: videoStreamDetails ? [videoStreamDetails] : undefined,
      audioDetails: isEmpty(audioStreamDetails)
        ? undefined
        : (audioStreamDetails as NonEmptyArray<AudioStreamDetails>),
      subtitleDetails: isNonEmptyArray(subtitleStreamDetails)
        ? subtitleStreamDetails
        : undefined,
      duration: dayjs.duration(item.duration),
    };

    if (audioOnly) {
      // TODO Use our proxy endpoint here
      const placeholderThumbPath =
        media.Type === 'Audio'
          ? (media.AlbumId ?? first(media.ArtistItems)?.Id ?? media.Id)
          : (media.SeasonId ?? media.Id);

      // We have to check that we can hit this URL or the stream will not work
      if (isNonEmptyString(placeholderThumbPath)) {
        const path = `/Items/${placeholderThumbPath}/Images/Primary`;
        const result = await attempt(() => this.emby.doHead({ url: path }));
        if (!isError(result)) {
          streamDetails.placeholderImage = new HttpStreamSource(
            this.emby.getFullUrl(path),
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
}

function extractIsAnamorphic(
  width: number,
  height: number,
  aspectRatioString: string,
) {
  const resolutionRatio = width / height;
  const [numS, denS] = aspectRatioString.split(':');
  const num = parseFloat(numS!);
  const den = parseFloat(denS!);
  if (isNaN(num) || isNaN(den)) {
    return false;
  }

  return Math.abs(resolutionRatio - num / den) > 0.01;
}
