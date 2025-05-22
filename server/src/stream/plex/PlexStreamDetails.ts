import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { PlexMediaSource } from '@/db/schema/MediaSource.js';
import { isQueryError, isQuerySuccess } from '@/external/BaseApiClient.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { KEYS } from '@/types/inject.js';
import { Maybe, Nullable } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import {
  attempt,
  isDefined,
  isNonEmptyArray,
  isNonEmptyString,
} from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
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
  replace,
  round,
  sortBy,
  trimEnd,
} from 'lodash-es';
import { PlexBackedStreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import {
  ExternalStreamDetailsFetcher,
  StreamFetchRequest,
} from '../StreamDetailsFetcher.ts';
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
export class PlexStreamDetails extends ExternalStreamDetailsFetcher<'plex'> {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settings: ISettingsDB,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  async getStream({ server, lineupItem }: StreamFetchRequest<'plex'>) {
    return this.getStreamInternal(server, lineupItem);
  }

  private async getStreamInternal(
    server: PlexMediaSource,
    item: PlexBackedStreamLineupItem,
    depth: number = 0,
  ): Promise<Nullable<ProgramStreamResult>> {
    if (depth > 1) {
      return null;
    }

    const plexApiClient =
      await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(server);

    const expectedItemType = item.programType;
    const itemMetadataResult = await plexApiClient.getItemMetadata(
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
          const byGuidResult = await plexApiClient.doTypeCheckedGet(
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
                server.name,
                { externalKey: newRatingKey },
              );
              return this.getStreamInternal(
                server,
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

    if (!isTerminalItem(itemMetadata)) {
      this.logger.warn(
        'Got unexpected item type %s from Plex (ID = %s) when starting stream. Expected item type %s',
        itemMetadata.type,
        item.externalKey,
        expectedItemType,
      );
      return null;
    }

    const details = await this.getItemStreamDetails(
      item,
      itemMetadata,
      plexApiClient,
    );

    if (isNull(details)) {
      return null;
    }

    if (
      isNonEmptyString(details.serverPath) &&
      details.serverPath !== item.plexFilePath
    ) {
      this.programDB
        .updateProgramPlexRatingKey(item.programId, server.name, {
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
      this.logger.debug(
        'Plex server %s configured to use "direct" streaming. Attempting to load program at %s',
        server.name,
        filePath,
      );
      streamSource = {
        type: 'file',
        path: replace(
          filePath,
          streamSettings.pathReplace,
          streamSettings.pathReplaceWith,
        ),
      };
    } else {
      const existsAtPath =
        isNonEmptyString(filePath) && (await fileExists(filePath));
      if (existsAtPath) {
        this.logger.debug(
          'Plex server %s configured for "network" streaming, but found file located at %s. Using file on disk.',
          server.name,
          filePath,
        );
        streamSource = {
          type: 'file',
          path: filePath,
        };
      } else {
        let path = details.serverPath ?? item.plexFilePath;
        this.logger.debug(
          'Did not find Plex file on disk relative to Tunarr. Using network path: %s',
          path,
        );

        if (isNonEmptyString(path)) {
          path = path.startsWith('/') ? path : `/${path}`;

          streamSource = new HttpStreamSource(
            `${trimEnd(server.uri, '/')}${path}?X-Plex-Token=${
              server.accessToken
            }`,
          );
          // streamUrl = this.getPlexTranscodeStreamUrl(
          //   `/library/metadata/${item.externalKey}`,
          // );
        } else {
          throw new Error('Could not resolve stream URL');
        }
      }
    }

    return {
      streamSource,
      streamDetails: details,
    };
  }

  private async getItemStreamDetails(
    item: PlexBackedStreamLineupItem,
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

    const subtitleStreamDetails = map(
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
      (stream) => {
        const sdh = !![
          stream.title,
          stream.displayTitle,
          stream.extendedDisplayTitle,
        ]
          .filter(isNonEmptyString)
          .find((s) => s.toLocaleLowerCase().includes('sdh'));
        return {
          type: isDefined(stream.index) ? 'embedded' : 'external',
          codec: stream.codec,
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
