import { ProgramDB } from '@/db/ProgramDB.ts';
import { SettingsDB } from '@/db/SettingsDB.ts';
import { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import { MediaSourceTable } from '@/db/schema/MediaSource.ts';
import { ProgramType } from '@/db/schema/Program.ts';
import { isQueryError } from '@/external/BaseApiClient.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { JellyfinItemFinder } from '@/external/jellyfin/JellyfinItemFinder.ts';
import { Maybe, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { Selectable } from 'kysely';
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
  takeWhile,
  trimEnd,
  trimStart,
} from 'lodash-es';
import { NonEmptyArray } from 'ts-essentials';
import {
  ifDefined,
  isDefined,
  isNonEmptyString,
  nullToUndefined,
} from '../../util/index.js';
import {
  AudioStreamDetails,
  HttpStreamSource,
  ProgramStreamResult,
  StreamDetails,
  StreamSource,
  VideoStreamDetails,
} from '../types.js';

// The minimum fields we need to get stream details about an item
// TODO: See if we need separate types for JF and Plex and what is really necessary here
type JellyfinItemStreamDetailsQuery = Pick<
  ContentBackedStreamLineupItem,
  'programType' | 'externalKey' | 'serverPath' | 'serverFilePath' | 'programId'
>;

export class JellyfinStreamDetails {
  private logger: Logger;
  private jellyfin: JellyfinApiClient;

  constructor(
    private server: Selectable<MediaSourceTable>,
    private settings: SettingsDB,
    private jellyfinItemFinder: JellyfinItemFinder = new JellyfinItemFinder(
      new ProgramDB(),
    ),
  ) {
    this.logger = LoggerFactory.child({
      jellyfinServer: server.name,
      caller: import.meta,
      className: this.constructor.name,
    });
  }

  async getStream(item: JellyfinItemStreamDetailsQuery) {
    return this.getStreamInternal(item);
  }

  private async getStreamInternal(
    item: JellyfinItemStreamDetailsQuery,
    depth: number = 0,
  ): Promise<Nullable<ProgramStreamResult>> {
    if (depth > 1) {
      return null;
    }

    this.jellyfin = await MediaSourceApiFactory().getJellyfinClient({
      apiKey: this.server.accessToken,
      url: this.server.uri,
      name: this.server.name,
    });

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

    if (expectedItemType !== jellyfinItemTypeToProgramType(itemMetadata)) {
      this.logger.warn(
        'Got unexpected item type %s from Jellyfin (ID = %s) when starting stream. Expected item type %s',
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

    // if (
    //   isNonEmptyString(details.serverPath) &&
    //   details.serverPath !== item.plexFilePath
    // ) {
    //   this.programDB
    //     .updateProgramPlexRatingKey(item.programId, this.server.name, {
    //       externalKey: item.externalKey,
    //       externalFilePath: details.serverPath,
    //       directFilePath: details.directFilePath,
    //     })
    //     .catch((err) => {
    //       this.logger.error(
    //         err,
    //         'Error while updating Jellyfin file path for program %s',
    //         item.programId,
    //       );
    //     });
    // }

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
      const path = details.serverPath ?? item.serverPath;
      if (isNonEmptyString(path)) {
        streamSource = new HttpStreamSource(
          `${trimEnd(this.server.uri, '/')}/Videos/${trimStart(
            path,
            '/',
          )}/stream?static=true`,
          {
            // TODO: Use the real authorization string
            'X-Emby-Token': this.server.accessToken,
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
    item: JellyfinItemStreamDetailsQuery,
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
        videoStream.IsAnamorphic ??
        (isNonEmptyString(videoStream.AspectRatio) &&
          videoStream.AspectRatio.includes(':'))
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
      filter(
        firstMediaSource?.MediaStreams,
        (stream) => stream.Type === 'Audio',
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
          ? media.AlbumId ?? first(media.ArtistItems)?.Id ?? media.Id
          : media.SeasonId ?? media.Id;

      // We have to check that we can hit this URL or the stream will not work
      if (isNonEmptyString(placeholderThumbPath)) {
        const path = `/Items/${placeholderThumbPath}/Images/Primary`;
        const result = await attempt(() => this.jellyfin.doHead({ url: path }));
        if (!isError(result)) {
          streamDetails.placeholderImage = this.jellyfin.getFullUrl(path);
        }
      }

      if (isEmpty(streamDetails.placeholderImage)) {
        streamDetails.placeholderImage = makeLocalUrl(
          '/images/generic-music-screen.png',
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

function jellyfinItemTypeToProgramType(item: JellyfinItem) {
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
