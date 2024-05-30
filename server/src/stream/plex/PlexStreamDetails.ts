import {
  PlexEpisode,
  PlexMediaAudioStream,
  PlexMediaVideoStream,
  PlexMovie,
  PlexMusicTrack,
} from '@tunarr/types/plex';
import {
  find,
  first,
  indexOf,
  isNull,
  isUndefined,
  replace,
  trimEnd,
} from 'lodash-es';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings';
import { Plex, PlexApiFactory } from '../../external/plex';
import { Nullable } from '../../types/util';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory';
import { PlexStream, StreamDetails } from './PlexTranscoder';
import { isNonEmptyString } from '../../util';
import { ContentBackedStreamLineupItem } from '../../dao/derived_types/StreamLineup.js';
import { SettingsDB } from '../../dao/settings.js';
import { makeLocalUrl } from '../../util/serverUtil.js';

// The minimum fields we need to get stream details about an item
type PlexItemStreamDetailsQuery = Pick<
  ContentBackedStreamLineupItem,
  'programType' | 'externalKey' | 'plexFilePath' | 'filePath'
>;

/**
 * A 'new' version of the PlexTranscoder class that does not
 * invoke the transcoding on Plex at all. Instead, it gathers stream
 * metadata through standard Plex endpoints and always "direct plays" items,
 * leaving normalization up to the Tunarr FFMPEG pipeline.
 */
export class PlexStreamDetails {
  private logger: Logger;

  constructor(
    private server: PlexServerSettings,
    private settings: SettingsDB,
  ) {
    this.logger = LoggerFactory.child({
      plexServer: server.name,
      // channel: channel.uuid,
      caller: import.meta,
    });
  }

  async getStream(
    item: PlexItemStreamDetailsQuery,
  ): Promise<Nullable<PlexStream>> {
    const plex = PlexApiFactory.get(this.server);
    const expectedItemType = item.programType;
    const itemMetadata = await plex.getItemMetadata(item.externalKey);

    if (isUndefined(itemMetadata)) {
      // This will have to throw somewhere!
      return null;
    }

    if (expectedItemType !== itemMetadata.type) {
      this.logger.warn(
        'Got unexpected item type %s from Plex (ID = %s) when starting stream. Expected item type %s',
        itemMetadata.type,
        item.externalKey,
        expectedItemType,
      );
      return null;
    }

    const details = this.getItemStreamDetails(item, itemMetadata);

    if (isNull(details)) {
      return null;
    }

    const streamSettings = this.settings.plexSettings();

    let streamUrl: string;
    const filePath = first(first(itemMetadata.Media)?.Part)?.file;
    if (streamSettings.streamPath === 'direct' && isNonEmptyString(filePath)) {
      streamUrl = replace(
        filePath,
        streamSettings.pathReplace,
        streamSettings.pathReplaceWith,
      );
    } else {
      const path = item.plexFilePath.startsWith('/')
        ? item.plexFilePath
        : `/${item.plexFilePath}`;
      streamUrl = `${trimEnd(this.server.uri, '/')}${path}?X-Plex-Token=${
        this.server.accessToken
      }`;
    }

    return {
      directPlay: true,
      streamUrl,
      streamDetails: details,
    };
  }

  private getItemStreamDetails(
    item: PlexItemStreamDetailsQuery,
    media: PlexMovie | PlexEpisode | PlexMusicTrack,
  ): Nullable<StreamDetails> {
    const streamDetails: StreamDetails = {};
    const firstStream = first(first(media.Media)?.Part)?.Stream;
    if (isUndefined(firstStream)) {
      this.logger.error(
        'Could not extract a stream for Plex item ID = %s',
        item.externalKey,
      );
    }

    const videoStream = find(
      firstStream,
      (stream): stream is PlexMediaVideoStream => stream.streamType === 1,
    );

    const audioStream = find(
      firstStream,
      (stream): stream is PlexMediaAudioStream =>
        stream.streamType === 2 && !!stream.selected,
    );
    const audioOnly = isUndefined(videoStream) && !isUndefined(audioStream);

    // Video
    if (!isUndefined(videoStream)) {
      // TODO Parse pixel aspect ratio
      streamDetails.anamorphic =
        videoStream.anamorphic === '1' || videoStream.anamorphic === true;
      streamDetails.videoCodec = videoStream.codec;
      // Keeping old behavior here for now
      streamDetails.videoFramerate = Math.round(videoStream.frameRate);
      streamDetails.videoHeight = videoStream.height;
      streamDetails.videoWidth = videoStream.width;
      streamDetails.videoBitDepth = videoStream.bitDepth;
      streamDetails.pixelP = 1;
      streamDetails.pixelQ = 1;
    }

    if (!isUndefined(audioStream)) {
      streamDetails.audioChannels = audioStream.channels;
      streamDetails.audioCodec = audioStream.codec;
      // TODO: I dont love calling indexOf when we already searched for this
      // stream in the list in the first place
      streamDetails.audioIndex = indexOf(firstStream, audioStream)?.toString();
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
      streamDetails.placeholderImage = Plex.getThumbUrl({
        ...this.server,
        itemKey: item.externalKey,
      });

      if (!isNonEmptyString(streamDetails.placeholderImage)) {
        streamDetails.placeholderImage = makeLocalUrl(
          '/images/generic-music-screen.png',
        );
      }
    }

    streamDetails.audioOnly = audioOnly;

    return streamDetails;
  }
}
