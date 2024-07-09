import {
  find,
  first,
  isNull,
  replace,
  trimEnd,
  isUndefined,
  attempt,
  isError,
  isEmpty,
  trimStart,
} from 'lodash-es';
import { MediaSource } from '../../dao/entities/MediaSource.js';
import { ProgramDB } from '../../dao/programDB.js';
import { SettingsDB } from '../../dao/settings.js';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.js';
import {
  isDefined,
  isNonEmptyString,
  nullToUndefined,
} from '../../util/index.js';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../../util/serverUtil.js';
import { PlexStream } from '../types.js';
import { StreamDetails } from '../types.js';
import { ContentBackedStreamLineupItem } from '../../dao/derived_types/StreamLineup.js';
import { Nullable } from '../../types/util.js';
import { isQueryError } from '../../external/BaseApiClient.js';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { ProgramType } from '../../dao/entities/Program.js';

// The minimum fields we need to get stream details about an item
// TODO: See if we need separate types for JF and Plex and what is really necessary here
type JellyfinItemStreamDetailsQuery = Pick<
  ContentBackedStreamLineupItem,
  'programType' | 'externalKey' | 'plexFilePath' | 'filePath' | 'programId'
>;

export class JellyfinStreamDetails {
  private logger: Logger;
  private jellyfin: JellyfinApiClient;

  constructor(
    private server: MediaSource,
    private settings: SettingsDB,
    private programDB: ProgramDB,
  ) {
    this.logger = LoggerFactory.child({
      jellyfinServer: server.name,
      // channel: channel.uuid,
      caller: import.meta,
    });

    this.jellyfin = MediaSourceApiFactory().getJellyfinClient({
      apiKey: server.accessToken,
      type: 'jellyfin',
      url: server.uri,
      name: server.name,
    });
  }

  async getStream(item: JellyfinItemStreamDetailsQuery) {
    return this.getStreamInternal(item);
  }

  private async getStreamInternal(
    item: JellyfinItemStreamDetailsQuery,
    depth: number = 0,
  ): Promise<Nullable<PlexStream>> {
    if (depth > 1) {
      return null;
    }

    const expectedItemType = item.programType;
    const itemMetadataResult = await this.jellyfin.getItem(item.externalKey);

    if (isQueryError(itemMetadataResult)) {
      this.logger.error(itemMetadataResult, 'Error getting Jellyfin stream');
      return null;
    } else if (isUndefined(itemMetadataResult.data)) {
      this.logger.error(
        'Jellyfin item with ID %s does not exist',
        item.externalKey,
      );
      return null;
    }

    const itemMetadata = itemMetadataResult.data;

    if (expectedItemType !== jellyfinItemTypeToProgramType(itemMetadata)) {
      this.logger.warn(
        'Got unexpected item type %s from Plex (ID = %s) when starting stream. Expected item type %s',
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

    if (
      isNonEmptyString(details.serverPath) &&
      details.serverPath !== item.plexFilePath
    ) {
      this.programDB
        .updateProgramPlexRatingKey(item.programId, this.server.name, {
          externalKey: item.externalKey,
          externalFilePath: details.serverPath,
          directFilePath: details.directFilePath,
        })
        .catch((err) => {
          this.logger.error(
            err,
            'Error while updating Plex file path for program %s',
            item.programId,
          );
        });
    }

    const streamSettings = this.settings.plexSettings();

    let streamUrl: string;
    const filePath =
      details.directFilePath ?? first(itemMetadata?.MediaSources)?.Path;
    if (streamSettings.streamPath === 'direct' && isNonEmptyString(filePath)) {
      streamUrl = replace(
        filePath,
        streamSettings.pathReplace,
        streamSettings.pathReplaceWith,
      );
    } else {
      const path = details.serverPath ?? item.plexFilePath;
      if (isNonEmptyString(path)) {
        streamUrl = `${trimEnd(this.server.uri, '/')}/Videos/${trimStart(
          path,
          '/',
        )}/stream`;
      } else {
        throw new Error('Could not resolve stream URL');
      }
    }

    return {
      directPlay: true,
      streamUrl,
      streamDetails: details,
    };
  }

  private async getItemStreamDetails(
    item: JellyfinItemStreamDetailsQuery,
    media: JellyfinItem,
  ): Promise<Nullable<StreamDetails>> {
    const streamDetails: StreamDetails = {};
    const firstMediaSource = first(media.MediaSources);
    streamDetails.serverPath = nullToUndefined(firstMediaSource?.Id);
    streamDetails.directFilePath = nullToUndefined(firstMediaSource?.Path);

    // const firstStream = firstPart?.Stream;
    // if (isUndefined(firstStream)) {
    //   this.logger.error(
    //     'Could not extract a stream for Jellyfin item ID = %s',
    //     item.externalKey,
    //   );
    // }

    const videoStream = find(
      firstMediaSource?.MediaStreams,
      (stream) => stream.Type === 'Video',
    );

    const audioStream = find(
      firstMediaSource?.MediaStreams,
      (stream) => stream.Type === 'Audio' && !!stream.IsDefault,
    );
    const audioOnly = isUndefined(videoStream) && !isUndefined(audioStream);

    // Video
    if (isDefined(videoStream)) {
      // TODO Parse pixel aspect ratio
      streamDetails.anamorphic = !!videoStream.IsAnamorphic;
      streamDetails.videoCodec = nullToUndefined(videoStream.Codec);
      // Keeping old behavior here for now
      streamDetails.videoFramerate = videoStream.AverageFrameRate
        ? Math.round(videoStream.AverageFrameRate)
        : undefined;
      streamDetails.videoHeight = nullToUndefined(videoStream.Height);
      streamDetails.videoWidth = nullToUndefined(videoStream.Width);
      streamDetails.videoBitDepth = nullToUndefined(videoStream.BitDepth);
      streamDetails.pixelP = 1;
      streamDetails.pixelQ = 1;
    }

    if (isDefined(audioStream)) {
      streamDetails.audioChannels = nullToUndefined(audioStream.Channels);
      streamDetails.audioCodec = nullToUndefined(audioStream.Codec);
      streamDetails.audioIndex =
        nullToUndefined(audioStream.Index?.toString()) ?? 'a';
    }

    if (isUndefined(videoStream) && isUndefined(audioStream)) {
      this.logger.warn(
        'Could not find a video nor audio stream for Plex item %s',
        item.externalKey,
      );
      return null;
    }

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

function jellyfinItemTypeToProgramType(item: JellyfinItem) {
  switch (item.Type) {
    case 'Movie':
      return ProgramType.Movie;
    case 'Episode':
      return ProgramType.Episode;
    case 'Audio':
      return ProgramType.Track;
    default:
      return null;
  }
}
