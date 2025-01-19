import { ProgramDB } from '@/db/ProgramDB.js';
import { SettingsDB, getSettings } from '@/db/SettingsDB.js';
import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { MediaSourceTable } from '@/db/schema/MediaSource.js';
import { isQueryError, isQuerySuccess } from '@/external/BaseApiClient.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Maybe, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { attempt, isNonEmptyString } from '@/util/index.js';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
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
  filter,
  find,
  first,
  isEmpty,
  isError,
  isNull,
  isUndefined,
  map,
  maxBy,
  replace,
  round,
  sortBy,
  trimEnd,
} from 'lodash-es';
import { NonEmptyArray } from 'ts-essentials';
import {
  AudioStreamDetails,
  HttpStreamSource,
  ProgramStreamResult,
  StreamDetails,
  StreamSource,
  VideoStreamDetails,
} from '../types.ts';

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
  ): Promise<Nullable<ProgramStreamResult>> {
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
          directFilePath: details.directFilePath ?? null,
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

        streamSource = new HttpStreamSource(
          `${trimEnd(this.server.uri, '/')}${path}?X-Plex-Token=${
            this.server.accessToken
          }`,
        );
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
        streamIndex: videoStream.index?.toString() ?? '0',
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
          index: audioStream.index?.toString() ?? 'a', // Fallback for legacy pipeline
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

    const streamDetails: StreamDetails = {
      serverPath: relevantPart?.key,
      directFilePath: relevantPart?.file,
      videoDetails: videoDetails ? [videoDetails] : undefined,
      audioDetails: isEmpty(audioStreamDetails)
        ? undefined
        : (audioStreamDetails as NonEmptyArray<AudioStreamDetails>),
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
        ? media.parentThumb ?? media.grandparentThumb ?? media.thumb
        : media.thumb;

      // streamDetails.placeholderImage =

      // We have to check that we can hit this URL or the stream will not work
      if (isNonEmptyString(placeholderThumbPath)) {
        const result = await attempt(() =>
          this.plex.doHead({ url: placeholderThumbPath }),
        );
        if (!isError(result)) {
          streamDetails.placeholderImage = new HttpStreamSource(
            this.plex.getFullUrl(placeholderThumbPath),
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
