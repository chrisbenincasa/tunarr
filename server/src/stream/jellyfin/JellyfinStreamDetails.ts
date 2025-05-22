import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import { type ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { MediaSource } from '@/db/schema/MediaSource.js';
import { isQueryError } from '@/external/BaseApiClient.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { JellyfinItemFinder } from '@/external/jellyfin/JellyfinItemFinder.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { JellyfinItem } from '@tunarr/types/jellyfin';
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
  orderBy,
  replace,
  takeWhile,
  trimEnd,
  trimStart,
} from 'lodash-es';
import {
  ifDefined,
  isDefined,
  isNonEmptyArray,
  isNonEmptyString,
  nullToUndefined,
} from '../../util/index.js';
import {
  ExternalStreamDetailsFetcher,
  StreamFetchRequest,
} from '../StreamDetailsFetcher.ts';
import {
  type AudioStreamDetails,
  HttpStreamSource,
  type ProgramStreamResult,
  type StreamDetails,
  type StreamSource,
  SubtitleStreamDetails,
  type VideoStreamDetails,
} from '../types.js';

@injectable()
export class JellyfinStreamDetails extends ExternalStreamDetailsFetcher {
  private jellyfin: JellyfinApiClient;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settings: ISettingsDB,
    @inject(JellyfinItemFinder) private jellyfinItemFinder: JellyfinItemFinder,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  async getStream({ server, lineupItem: query }: StreamFetchRequest) {
    return this.getStreamInternal(server, query);
  }

  private async getStreamInternal(
    mediaSource: MediaSource,
    item: ContentBackedStreamLineupItem,
    depth: number = 0,
  ): Promise<Nullable<ProgramStreamResult>> {
    if (depth > 1) {
      return null;
    }

    this.jellyfin =
      await this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
        mediaSource,
      );

    const expectedItemType = item.programType;
    const itemMetadataResult = await this.jellyfin.getItem(item.externalKey);

    if (isQueryError(itemMetadataResult)) {
      this.logger.error(itemMetadataResult, 'Error getting Jellyfin stream');
      return null;
    } else if (isUndefined(itemMetadataResult.data)) {
      this.logger.error(
        'Jellyfin item with ID %s does not exist. Underlying file might have change. Attempting to locate it.',
        item.externalKey,
      );
      const newExternalId =
        await this.jellyfinItemFinder.findForProgramAndUpdate(item.programId);

      if (newExternalId) {
        return this.getStreamInternal(
          mediaSource,
          {
            ...item,
            ...newExternalId,
          },
          depth + 1,
        );
      }

      return null;
    }

    const itemMetadata = itemMetadataResult.data;

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
          )}/stream?static=true`,
          {
            // TODO: Use the real authorization string
            'X-Emby-Token': mediaSource.accessToken,
          },
        );
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
    media: JellyfinItem,
  ): Promise<Nullable<StreamDetails>> {
    const firstMediaSource = first(media.MediaSources);

    // Jellyfin orders media streams with external ones first
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
      orderBy(
        filter(
          firstMediaSource?.MediaStreams,
          (stream) => stream.Type === 'Audio',
        ),
        [(stream) => stream.Index ?? 0, (stream) => !stream.IsDefault],
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

    const subtitleStreamDetails = map(
      orderBy(
        filter(
          firstMediaSource?.MediaStreams,
          (stream) => stream.Type === 'Subtitle',
        ),
        [(stream) => stream.Index ?? 0, (stream) => !stream.IsDefault],
      ),
      (subtitleStream) => {
        return {
          codec: subtitleStream.Codec ?? 'unknown',
          default: subtitleStream.IsDefault ?? false,
          forced: subtitleStream.IsForced ?? false,
          sdh: subtitleStream.IsHearingImpaired ?? false,
          type: subtitleStream.IsExternal ? 'external' : 'embedded',
          description: subtitleStream.Title ?? '',
          index:
            ifDefined(subtitleStream.Index, (streamIndex) => {
              const index = streamIndex - externalStreamCount;
              if (index >= 0) {
                return index;
              }
              return;
            }) ?? undefined,
          languageCodeISO6392: subtitleStream.Language ?? undefined,
          path: subtitleStream.Path ?? undefined,
          title: subtitleStream.DisplayTitle ?? undefined,
        } satisfies SubtitleStreamDetails;
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
      audioDetails: isNonEmptyArray(audioStreamDetails)
        ? audioStreamDetails
        : undefined,
      subtitleDetails: isNonEmptyArray(subtitleStreamDetails)
        ? subtitleStreamDetails
        : undefined,
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
        const result = await attempt(() => this.jellyfin.doHead({ url: path }));
        if (!isError(result)) {
          streamDetails.placeholderImage = new HttpStreamSource(
            this.jellyfin.getFullUrl(path),
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
