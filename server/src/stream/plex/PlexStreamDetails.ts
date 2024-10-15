import {
  PlexEpisode,
  PlexMediaAudioStream,
  PlexMediaContainerResponseSchema,
  PlexMediaVideoStream,
  PlexMovie,
  PlexMusicTrack,
  isPlexMusicTrack,
} from '@tunarr/types/plex';
import { Selectable } from 'kysely';
import {
  find,
  first,
  isEmpty,
  isError,
  isNull,
  isUndefined,
  replace,
  trimEnd,
} from 'lodash-es';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType';
import { ContentBackedStreamLineupItem } from '../../dao/derived_types/StreamLineup.js';
import { MediaSourceTable } from '../../dao/direct/schema/MediaSource';
import { ProgramDB } from '../../dao/programDB';
import { SettingsDB, getSettings } from '../../dao/settings.js';
import { isQueryError, isQuerySuccess } from '../../external/BaseApiClient.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory';
import { PlexApiClient } from '../../external/plex/PlexApiClient';
import { Nullable } from '../../types/util';
import { attempt, isNonEmptyString } from '../../util';
import { fileExists } from '../../util/fsUtil';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory';
import { makeLocalUrl } from '../../util/serverUtil.js';
import { ProgramStream, StreamDetails, StreamSource } from '../types';

// The minimum fields we need to get stream details about an item
type PlexItemStreamDetailsQuery = Pick<
  ContentBackedStreamLineupItem,
  'programType' | 'externalKey' | 'plexFilePath' | 'filePath' | 'programId'
>;

/**
 * A 'new' version of the PlexTranscoder class that does not
 * invoke the transcoding on Plex at all. Instead, it gathers stream
 * metadata through standard Plex endpoints and always "direct plays" items,
 * leaving normalization up to the Tunarr FFMPEG pipeline.
 */
export class PlexStreamDetails {
  private logger: Logger;
  private plex: PlexApiClient;

  constructor(
    private server: Selectable<MediaSourceTable>,
    private settings: SettingsDB = getSettings(),
    private programDB: ProgramDB = new ProgramDB(),
  ) {
    this.logger = LoggerFactory.child({
      plexServer: server.name,
      caller: import.meta,
      className: this.constructor.name,
    });

    this.plex = MediaSourceApiFactory().get(this.server);
  }

  async getStream(item: PlexItemStreamDetailsQuery) {
    return this.getStreamInternal(item);
  }

  private async getStreamInternal(
    item: PlexItemStreamDetailsQuery,
    depth: number = 0,
  ): Promise<Nullable<ProgramStream>> {
    if (depth > 1) {
      return null;
    }

    const expectedItemType = item.programType;
    const itemMetadataResult = await this.plex.getItemMetadata(
      item.externalKey,
    );

    if (isQueryError(itemMetadataResult)) {
      if (itemMetadataResult.code === 'not_found') {
        this.logger.debug(
          'Could not find item %s in Plex. Rating key may have changed. Attempting to update.',
          item.externalKey,
        );
        const externalIds = await this.programDB.getProgramExternalIds(
          item.programId,
        );
        const plexGuid = find(
          externalIds,
          (eid) => eid.sourceType === ProgramExternalIdType.PLEX_GUID,
        )?.externalKey;
        if (isNonEmptyString(plexGuid)) {
          const byGuidResult = await this.plex.doTypeCheckedGet(
            '/library/all',
            PlexMediaContainerResponseSchema,
            {
              params: {
                guid: plexGuid,
              },
            },
          );

          if (isQuerySuccess(byGuidResult)) {
            if (byGuidResult.data.MediaContainer.size > 0) {
              this.logger.debug(
                'Found %d matching items in library. Using the first',
                byGuidResult.data.MediaContainer.size,
              );
              const metadata = first(
                byGuidResult.data.MediaContainer.Metadata,
              )!;
              const newRatingKey = metadata.ratingKey;
              this.logger.debug(
                'Updating program %s with new Plex rating key %s',
                item.programId,
                newRatingKey,
              );
              await this.programDB.updateProgramPlexRatingKey(
                item.programId,
                this.server.name,
                { externalKey: newRatingKey },
              );
              return this.getStreamInternal(
                {
                  ...item,
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
      return null;
    }

    const itemMetadata = itemMetadataResult.data;

    if (expectedItemType !== itemMetadata.type) {
      this.logger.warn(
        'Got unexpected item type %s from Plex (ID = %s) when starting stream. Expected item type %s',
        itemMetadata.type,
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

    let streamSource: StreamSource;
    const filePath =
      details.directFilePath ?? first(first(itemMetadata.Media)?.Part)?.file;
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
      let path = details.serverPath ?? item.plexFilePath;

      if (isNonEmptyString(path)) {
        path = path.startsWith('/') ? path : `/${path}`;
        streamSource = {
          type: 'http',
          streamUrl: `${trimEnd(this.server.uri, '/')}${path}?X-Plex-Token=${
            this.server.accessToken
          }`,
        };
        // streamUrl = this.getPlexTranscodeStreamUrl(
        //   `/library/metadata/${item.externalKey}`,
        // );
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
    item: PlexItemStreamDetailsQuery,
    media: PlexMovie | PlexEpisode | PlexMusicTrack,
  ): Promise<Nullable<StreamDetails>> {
    const streamDetails: StreamDetails = {};
    const firstPart = first(first(media.Media)?.Part);
    streamDetails.serverPath = firstPart?.key;
    streamDetails.directFilePath = firstPart?.file;

    const firstStream = firstPart?.Stream;
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
      streamDetails.videoFramerate = videoStream.frameRate
        ? Math.round(videoStream.frameRate)
        : undefined;
      streamDetails.videoHeight = videoStream.height;
      streamDetails.videoWidth = videoStream.width;
      streamDetails.videoBitDepth = videoStream.bitDepth;
      streamDetails.videoStreamIndex = videoStream.index?.toString() ?? '0';
      streamDetails.pixelP = 1;
      streamDetails.pixelQ = 1;
    }

    if (!isUndefined(audioStream)) {
      streamDetails.audioChannels = audioStream.channels;
      streamDetails.audioCodec = audioStream.codec;
      streamDetails.audioIndex = audioStream?.index.toString() ?? 'a';
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
      const placeholderThumbPath = isPlexMusicTrack(media)
        ? media.parentThumb ?? media.grandparentThumb ?? media.thumb
        : media.thumb;

      // streamDetails.placeholderImage =

      // We have to check that we can hit this URL or the stream will not work
      if (isNonEmptyString(placeholderThumbPath)) {
        const result = await attempt(() =>
          this.plex.doHead({ url: placeholderThumbPath }),
        );
        if (!isError(result)) {
          streamDetails.placeholderImage =
            this.plex.getFullUrl(placeholderThumbPath);
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
