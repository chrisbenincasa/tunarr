import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import { type ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { MediaSource } from '@/db/schema/MediaSource.js';
import { ProgramType } from '@/db/schema/Program.js';
import { isQueryError } from '@/external/BaseApiClient.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { type EmbyItem } from '@tunarr/types/emby';
import { inject, injectable } from 'inversify';
import {
  attempt,
  filter,
  find,
  first,
  isEmpty,
  isError,
  isNull,
  isUndefined,
  map,
  replace,
  sortBy,
  takeWhile,
  trimEnd,
  trimStart,
} from 'lodash-es';
import { type NonEmptyArray } from 'ts-essentials';
import type { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import {
  ifDefined,
  isDefined,
  isNonEmptyString,
  nullToUndefined,
} from '../../util/index.ts';
import { StreamFetchRequest } from '../StreamDetailsFetcher.ts';
import {
  type AudioStreamDetails,
  HttpStreamSource,
  type ProgramStreamResult,
  type StreamDetails,
  type StreamSource,
  type VideoStreamDetails,
} from '../types.ts';

// TODO: this is basically an exact copy of the Jellyfin one, can we consolidate?
@injectable()
export class EmbyStreamDetails {
  private emby: EmbyApiClient;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settings: ISettingsDB,
    // @inject(EmbyItemFinder) private jellyfinItemFinder: EmbyItemFinder,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {}

  async getStream({ server, lineupItem }: StreamFetchRequest) {
    return this.getStreamInternal(server, lineupItem);
  }

  private async getStreamInternal(
    mediaSource: MediaSource,
    item: ContentBackedStreamLineupItem,
    depth: number = 0,
  ): Promise<Nullable<ProgramStreamResult>> {
    if (depth > 1) {
      return null;
    }

    this.emby =
      await this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
        mediaSource,
      );

    const expectedItemType = item.programType;
    const itemMetadataResult = await this.emby.getItem(item.externalKey);

    if (isQueryError(itemMetadataResult)) {
      this.logger.error(itemMetadataResult, 'Error getting Emby stream');
      return null;
    } else if (isUndefined(itemMetadataResult.data)) {
      this.logger.error(
        'Emby item with ID %s does not exist. Underlying file might have change. Attempting to locate it.',
        item.externalKey,
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

      return null;
    }

    const itemMetadata = itemMetadataResult.data;

    if (expectedItemType !== jellyfinItemTypeToProgramType(itemMetadata)) {
      this.logger.warn(
        'Got unexpected item type %s from Emby (ID = %s) when starting stream. Expected item type %s',
        itemMetadata.Type,
        item.externalKey,
        expectedItemType,
      );
      return null;
    }

    const details = await this.getItemStreamDetails(item, itemMetadata);

    if (isNull(details)) {
      return null;
    }

    const streamSettings = this.settings.plexSettings();

    let streamSource: StreamSource;
    const filePath =
      details.directFilePath ?? first(itemMetadata?.MediaSources)?.Path;
    if (streamSettings.streamPath === 'direct' && isNonEmptyString(filePath)) {
      streamSource = {
        type: 'file',
        path: replace(
          filePath,
          streamSettings.pathReplace,
          streamSettings.pathReplaceWith,
        ),
      };
    } else if (isNonEmptyString(filePath) && (await fileExists(filePath))) {
      streamSource = {
        type: 'file',
        path: filePath,
      };
    } else {
      const path = details.serverPath ?? item.plexFilePath;
      if (isNonEmptyString(path)) {
        streamSource = new HttpStreamSource(
          `${trimEnd(mediaSource.uri, '/')}/Videos/${trimStart(
            path,
            '/',
          )}/stream?static=true&X-Emby-Token=${mediaSource.accessToken}`,
        );
        console.log(streamSource);
      } else {
        throw new Error('Could not resolve stream URL');
      }
    }

    return {
      streamSource,
      streamDetails: details,
    };
  }

  private async getItemStreamDetails(
    item: ContentBackedStreamLineupItem,
    media: EmbyItem,
  ): Promise<Nullable<StreamDetails>> {
    const firstMediaSource = first(media.MediaSources);

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
              return index.toString();
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

    const audioStreamDetails = map(
      sortBy(
        filter(
          firstMediaSource?.MediaStreams,
          (stream) => stream.Type === 'Audio',
        ),
        (stream) => [stream.Index ?? 0, !stream.IsDefault],
      ),
      (audioStream) => {
        return {
          bitrate: nullToUndefined(audioStream.BitRate),
          channels: nullToUndefined(audioStream.Channels),
          codec: nullToUndefined(audioStream.Codec),
          default: !!audioStream.IsDefault,
          forced: audioStream.IsForced,
          index:
            ifDefined(audioStream.Index, (streamIndex) => {
              const index = streamIndex - externalStreamCount;
              if (index >= 0) {
                return index.toString();
              }
              return;
            }) ?? undefined,
          language: nullToUndefined(audioStream.Language),
          profile: nullToUndefined(audioStream.Profile),
          title: nullToUndefined(audioStream.Title),
          languageCodeISO6392: nullToUndefined(audioStream.Language),
        } satisfies AudioStreamDetails;
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

    const streamDetails: StreamDetails = {
      serverPath: nullToUndefined(firstMediaSource?.Id),
      directFilePath: nullToUndefined(firstMediaSource?.Path),
      videoDetails: videoStreamDetails ? [videoStreamDetails] : undefined,
      audioDetails: isEmpty(audioStreamDetails)
        ? undefined
        : (audioStreamDetails as NonEmptyArray<AudioStreamDetails>),
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
  const num = parseFloat(numS);
  const den = parseFloat(denS);
  if (isNaN(num) || isNaN(den)) {
    return false;
  }

  return Math.abs(resolutionRatio - num / den) > 0.01;
}

function jellyfinItemTypeToProgramType(item: EmbyItem) {
  switch (item.Type) {
    case 'Movie':
      return ProgramType.Movie;
    case 'Episode':
    case 'Video':
    case 'MusicVideo':
      return ProgramType.Episode;
    case 'Audio':
      return ProgramType.Track;
    default:
      return null;
  }
}
