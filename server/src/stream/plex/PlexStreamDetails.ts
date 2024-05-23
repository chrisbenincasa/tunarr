import { PlexMediaAudioStream, PlexMediaVideoStream } from '@tunarr/types/plex';
import { find, first, indexOf, isNull, isUndefined, trimEnd } from 'lodash-es';
import { v4 } from 'uuid';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings';
import { SettingsDB } from '../../dao/settings';
import { Plex, PlexApiFactory } from '../../external/plex';
import { Nullable } from '../../types/util';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory';
import { PlexStream, StreamDetails } from './plexTranscoder';
import { isNonEmptyString } from '../../util';
import { serverOptions } from '../../globals';

// The minimum fields we need to get stream details about an item
type PlexItemStreamDetailsQuery = {
  programType: 'movie' | 'episode' | 'track'; // HACK: this needs to be cenrtalized somewhere
  externalKey: string;
  plexFilePath: string;
};

/**
 * A 'new' version of the PlexTranscoder class that does not
 * invoke the transcoding on Plex at all. Instead, it gathers stream
 * metadata through standard Plex endpoints and always "direct plays" items,
 * leaving normalization up to the Tunarr FFMPEG pipeline.
 */
export class PlexStreamDetails {
  private logger: Logger;
  private session: string;

  constructor(
    private server: PlexServerSettings,
    private settingsDB: SettingsDB,
  ) {
    this.logger = LoggerFactory.child({
      plexServer: server.name,
      // channel: channel.uuid,
      caller: import.meta,
    });
    this.session = v4();
  }

  async getStream(
    item: PlexItemStreamDetailsQuery,
  ): Promise<Nullable<PlexStream>> {
    const path = item.plexFilePath.startsWith('/')
      ? item.plexFilePath
      : `/${item.plexFilePath}`;
    const details = await this.getItemStreamDetails(item);

    if (isNull(details)) {
      return null;
    }

    return {
      directPlay: true,
      streamUrl: `${trimEnd(this.server.uri, '/')}${path}?X-Plex-Token=${
        this.server.accessToken
      }`,
      streamDetails: details,
    };
  }

  async getItemStreamDetails(
    item: PlexItemStreamDetailsQuery,
  ): Promise<Nullable<StreamDetails>> {
    const streamDetails: StreamDetails = {};
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

    const firstStream = first(first(itemMetadata.Media)?.Part)?.Stream;
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
        streamDetails.placeholderImage = `http://localhost:${
          serverOptions().port
        }/images/generic-music-screen.png`;
      }
    }

    streamDetails.audioOnly = audioOnly;

    return streamDetails;
  }
}
