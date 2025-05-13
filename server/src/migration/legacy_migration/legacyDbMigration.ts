import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { NewCachedImage } from '@/db/schema/CachedImage.js';
import {
  ErrorScreenAudioType,
  ErrorScreenAudioTypes,
  ErrorScreenType,
  ErrorScreenTypes,
  NewTranscodeConfig,
  TranscodeAudioOutputFormats,
  TranscodeVideoOutputFormats,
} from '@/db/schema/TranscodeConfig.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { globalOptions } from '@/globals.js';
import { EventService } from '@/services/EventService.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { AnonymousTask } from '@/tasks/Task.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { attempt, inConstArr } from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import {
  FfmpegSettings,
  PlexServerSettings,
  PlexStreamSettings,
  defaultFfmpegSettings,
  defaultHdhrSettings,
  defaultPlexStreamSettings,
} from '@tunarr/types';
import {
  DefaultHardwareAccel,
  DefaultVideoFormat,
  SupportedHardwareAccels,
  SupportedVideoFormats,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import {
  isArray,
  isEmpty,
  isError,
  isObject,
  isUndefined,
  map,
  merge,
  mergeWith,
  sortBy,
} from 'lodash-es';
import fs from 'node:fs/promises';
import path, { dirname, join } from 'node:path';
import { v4 } from 'uuid';
import { Settings, defaultXmlTvSettings } from '../../db/SettingsDB.ts';
import {
  MediaSourceType,
  NewMediaSource,
} from '../../db/schema/MediaSource.ts';
import { DB } from '../../db/schema/db.ts';
import {
  LegacyChannelMigrator,
  LegacyProgram,
} from './LegacyChannelMigrator.ts';
import { LegacyLibraryMigrator } from './libraryMigrator.ts';
import { LegacyMetadataBackfiller } from './metadataBackfill.ts';
import { JSONArray, JSONObject, tryParseResolution } from './migrationUtil.ts';

export type CustomShow = {
  id: string;
  name: string;
  content: LegacyProgram[];
};

export const MigratableEntities = [
  'hdhr',
  'xmltv',
  'plex',
  'plex-servers',
  'custom-shows',
  'filler-shows',
  'channels',
  'ffmpeg',
  'cached-images',
];

@injectable()
export class LegacyDbMigrator {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settings: ISettingsDB,
    @inject(EventService) private eventService: EventService,
    @inject(LegacyChannelMigrator)
    private legacyChannelMigrator: LegacyChannelMigrator,
    @inject(LegacyMetadataBackfiller)
    private legacyMetadataBackiller: LegacyMetadataBackfiller,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(LegacyLibraryMigrator)
    private legacyLibraryMigrator: LegacyLibraryMigrator,
  ) {}

  async migrateFromLegacyDb(legacyDbPath: string, entities?: string[]) {
    const entitiesToMigrate = entities ?? MigratableEntities;
    // First initialize the default schema:
    // db.data = { ...defaultSchema(globalOptions().databaseDirectory) };
    // await db.write();

    let settings: Partial<Settings> = {};
    if (entitiesToMigrate.includes('hdhr')) {
      try {
        const hdhrSettings = await attempt(() =>
          this.readOldDbFile(legacyDbPath, 'hdhr-settings'),
        );
        if (isError(hdhrSettings)) {
          settings = {
            ...settings,
            hdhr: {
              ...defaultHdhrSettings,
            },
          };
        } else {
          this.logger.debug('Migrating HDHR settings', hdhrSettings);
          settings = {
            ...settings,
            hdhr: {
              autoDiscoveryEnabled:
                (hdhrSettings['autoDiscovery'] as Maybe<boolean>) ?? true,
              tunerCount: (hdhrSettings['tunerCount'] as Maybe<number>) ?? 2,
            },
          };
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate HDHR settings');
      }
    }

    if (entitiesToMigrate.includes('xmltv')) {
      try {
        const xmltvSettings = await attempt(() =>
          this.readOldDbFile(legacyDbPath, 'xmltv-settings'),
        );

        const defaultSettings = defaultXmlTvSettings(
          globalOptions().databaseDirectory,
        );

        if (isError(xmltvSettings)) {
          settings = {
            ...settings,
            xmltv: defaultSettings,
          };
        } else {
          this.logger.debug('Migrating XMLTV settings', xmltvSettings);
          settings = {
            ...settings,
            xmltv: merge({}, defaultSettings, {
              enableImageCache: xmltvSettings['enableImageCache'] as boolean,
              outputPath: xmltvSettings['file'] as string,
              programmingHours: xmltvSettings['cache'] as number,
              refreshHours: xmltvSettings['refresh'] as number,
            }),
          };
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate XMLTV settings');
      }
    }

    if (entitiesToMigrate.includes('plex')) {
      try {
        const plexSettings = await attempt(() =>
          this.readOldDbFile(legacyDbPath, 'plex-settings'),
        );
        if (isError(plexSettings)) {
          settings = {
            ...settings,
            plexStream: {
              ...defaultPlexStreamSettings,
            },
          };
        } else {
          this.logger.debug('Migrating Plex settings', plexSettings);
          settings = {
            ...settings,
            plexStream: mergeWith<
              Partial<PlexStreamSettings>,
              PlexStreamSettings
            >(
              {
                pathReplace: plexSettings['pathReplace'] as Maybe<string>,
                pathReplaceWith: plexSettings[
                  'pathReplaceWith'
                ] as Maybe<string>,
                updatePlayStatus:
                  plexSettings.updatePlayStatus as Maybe<boolean>,
              },
              defaultPlexStreamSettings,
              (legacyObjValue, defaultObjValue) => {
                if (isUndefined(legacyObjValue)) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                  return defaultObjValue;
                }
              },
            ),
          };
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate Plex settings');
      }
    }

    if (entitiesToMigrate.includes('plex-servers')) {
      const plexServers = await attempt(() =>
        this.readAllOldDbFile(legacyDbPath, 'plex-servers'),
      );
      try {
        if (!isError(plexServers)) {
          this.logger.debug('Migrating Plex servers', plexServers);
          let servers: JSONObject[] = [];
          if (isArray(plexServers)) {
            servers = [...plexServers] as JSONObject[];
          } else if (isObject(plexServers)) {
            servers = [plexServers];
          }
          const migratedServers: PlexServerSettings[] = sortBy(
            map(servers, (server) => {
              return {
                id: server['id'] as string | undefined,
                name: server['name'] as string,
                uri: server['uri'] as string,
                accessToken: server['accessToken'] as string,
                sendChannelUpdates: server['arChannels'] as boolean,
                sendGuideUpdates: server['arGuide'] as boolean,
                index: server['index'] as number,
              } as PlexServerSettings;
            }),
            'index',
          );

          const now = +dayjs();
          const entities: NewMediaSource[] = migratedServers.map((server) => {
            return {
              uuid: v4(),
              type: MediaSourceType.Plex,
              createdAt: now,
              updatedAt: now,
              name: server.name,
              accessToken: server.accessToken,
              uri: server.uri,
              sendChannelUpdates: booleanToNumber(server.sendChannelUpdates),
              sendGuideUpdates: booleanToNumber(server.sendGuideUpdates),
              index: server.index,
            } satisfies NewMediaSource;
          });

          // Don't bother filling in the client_identifier here, the Fixer
          // will take care of that -- we may want to do it here if we want
          // to remove the fixer eventually, though.
          for (const entity of entities) {
            const plexApi = await this.mediaSourceApiFactory.getPlexApiClient({
              accessToken: entity.accessToken,
              name: entity.name,
              url: entity.uri,
              userId: null,
              username: null,
            });
            const healthy = await plexApi.checkServerStatus();
            if (healthy) {
              this.logger.debug(
                'Plex server name: %s url: %s healthy',
                entity.name,
                entity.uri,
              );
            } else {
              this.logger.warn(
                'Plex server from legacy settings unhealthy: %s (%s)',
                entity.name,
                entity.uri,
              );
            }
          }

          await this.db
            .insertInto('mediaSource')
            .values(entities)
            .onConflict((oc) => oc.columns(['type', 'name', 'uri']).doNothing())
            .execute();
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate Plex server settings');
      }
    }

    if (entitiesToMigrate.includes('ffmpeg')) {
      try {
        const ffmpegSettings = await attempt(
          async () => await this.readOldDbFile(legacyDbPath, 'ffmpeg-settings'),
        );
        if (isError(ffmpegSettings)) {
          settings = {
            ...settings,
            ffmpeg: {
              ...defaultFfmpegSettings,
            },
          };
        } else {
          this.logger.debug('Migrating ffmpeg settings', ffmpegSettings);
          const legacyVideoEncoderSetting = ffmpegSettings[
            'videoEncoder'
          ] as string;
          // Attempt to map the previous setting if it is something we support
          let videoFormat: SupportedVideoFormats = DefaultVideoFormat;
          if (
            legacyVideoEncoderSetting.includes('x265') ||
            legacyVideoEncoderSetting.includes('hevc')
          ) {
            videoFormat = 'hevc';
          } else if (legacyVideoEncoderSetting.includes('mpeg2')) {
            videoFormat = 'mpeg2';
          }

          let hwAccel: SupportedHardwareAccels = DefaultHardwareAccel;
          if (legacyVideoEncoderSetting.includes('nvenc')) {
            hwAccel = 'cuda';
          } else if (legacyVideoEncoderSetting.includes('qsv')) {
            hwAccel = 'qsv';
          } else if (legacyVideoEncoderSetting.includes('vaapi')) {
            hwAccel = 'vaapi';
          } else if (legacyVideoEncoderSetting.includes('videotoolbox')) {
            hwAccel = 'videotoolbox';
          }

          const newFfmpegSettings = merge<FfmpegSettings, FfmpegSettings>(
            {
              configVersion: ffmpegSettings['configVersion'] as number,
              ffmpegExecutablePath: ffmpegSettings['ffmpegPath'] as string,
              ffprobeExecutablePath: join(
                dirname(ffmpegSettings['ffmpegPath'] as string),
                'ffprobe',
              ),
              enableLogging: ffmpegSettings['logFfmpeg'] as boolean,
              enableFileLogging: false,
              logLevel: 'warning',
              useNewFfmpegPipeline: true,
              hlsDirectOutputFormat: 'mpegts',
              languagePreferences: defaultFfmpegSettings.languagePreferences,
              scalingAlgorithm: ffmpegSettings[
                'scalingAlgorithm'
              ] as FfmpegSettings['scalingAlgorithm'],
              deinterlaceFilter: ffmpegSettings[
                'deinterlaceFilter'
              ] as FfmpegSettings['deinterlaceFilter'],
              enableSubtitleExtraction: false,
              hlsSegmentType: 'mpegts',
            },
            defaultFfmpegSettings,
          );

          settings = {
            ...settings,
            ffmpeg: newFfmpegSettings,
          };

          const audioSetting = TranscodeAudioOutputFormats.find(
            (fmt) => (ffmpegSettings['audioEncoder'] as string) === fmt,
          );
          const videoSetting = TranscodeVideoOutputFormats.find(
            (fmt) => videoFormat === fmt,
          );

          const deinterlaceFilter = ffmpegSettings[
            'deinterlaceFilter'
          ] as string;

          const errorScreen: ErrorScreenType = inConstArr(
            ErrorScreenTypes,
            ffmpegSettings['errorScreen'] as string,
          )
            ? (ffmpegSettings['errorScreen'] as ErrorScreenType)
            : 'pic';

          const errorAudio: ErrorScreenAudioType = inConstArr(
            ErrorScreenAudioTypes,
            ffmpegSettings['errorAudio'] as string,
          )
            ? (ffmpegSettings['errorAudio'] as ErrorScreenAudioType)
            : 'silent';

          const defaultTranscodeConfig: NewTranscodeConfig = {
            audioBitRate: ffmpegSettings['audioBitrate'] as number,
            audioBufferSize: ffmpegSettings['audioBufSize'] as number,
            audioChannels: ffmpegSettings['audioChannels'] as number,
            audioFormat: audioSetting ?? 'aac',
            audioSampleRate: ffmpegSettings['audioSampleRate'] as number,
            hardwareAccelerationMode: hwAccel,
            name: 'Default',
            resolution: JSON.stringify(
              tryParseResolution(
                ffmpegSettings['targetResolution'] as string,
              ) ?? { widthPx: 1920, heightPx: 1080 },
            ),
            threadCount: ffmpegSettings['threads'] as number,
            uuid: v4(),
            videoBitRate: ffmpegSettings['videoBitrate'] as number,
            videoBufferSize: ffmpegSettings['videoBufSize'] as number,
            videoFormat: videoSetting ?? 'h264',
            audioVolumePercent: ffmpegSettings['audioVolumePercent'] as number,
            deinterlaceVideo: booleanToNumber(deinterlaceFilter !== 'none'),
            disableChannelOverlay: booleanToNumber(
              ffmpegSettings['disableChannelOverlay'] as boolean,
            ),
            errorScreen,
            errorScreenAudio: errorAudio,
            normalizeFrameRate: booleanToNumber(false),
            vaapiDevice: undefined,
            videoBitDepth: 8,
            isDefault: booleanToNumber(true),
          };

          await this.db
            .insertInto('transcodeConfig')
            .values(defaultTranscodeConfig)
            .execute();
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate ffmpeg settings');
      }
    }

    try {
      this.logger.debug('Migrating client ID');
      const clientId = await this.readOldDbFile(legacyDbPath, 'client-id');
      settings = {
        ...settings,
        clientId: clientId['clientId'] as string,
      };
    } catch (e) {
      this.logger.error(e, 'Unable to migrate client ID');
    }

    if (entitiesToMigrate.includes('custom-shows')) {
      try {
        this.logger.debug('Migrating custom shows');
        await this.legacyLibraryMigrator.migrateCustomShows(
          legacyDbPath,
          'custom-shows',
        );
      } catch (e) {
        this.logger.error(e, 'Unable to migrate all custom shows');
      }
    }

    if (entitiesToMigrate.includes('filler-shows')) {
      try {
        this.logger.debug('Migrating filler shows');
        await this.legacyLibraryMigrator.migrateCustomShows(
          legacyDbPath,
          'filler',
        );
      } catch (e) {
        this.logger.error(e, 'Unable to migrate all filler shows');
      }
    }

    if (entitiesToMigrate.includes('channels')) {
      try {
        this.logger.debug('Migraing channels...');
        await this.legacyChannelMigrator.migrateChannels(legacyDbPath);
        // Finish this process in the background, since it could take a while
        GlobalScheduler.scheduleOneOffTask(
          'BackfillParentMetadata',
          dayjs().add(10, 'seconds').toDate(),
          [],
          AnonymousTask('BackfillParentMetadata', async () => {
            this.eventService.push({
              type: 'lifecycle',
              detail: {
                time: new Date().getTime(),
              },
              message:
                'Background metadata backfill in progress. Please be patient!',
              level: 'info',
            });
            return this.legacyMetadataBackiller.backfillParentMetadata();
          }),
        );
      } catch (e) {
        this.logger.error(e, 'Unable to migrate channels');
      }
    }

    if (entitiesToMigrate.includes('cached-images')) {
      try {
        this.logger.debug('Migrating cached images');
        const result = await this.migrateCachedImages(legacyDbPath);
        if (!isEmpty(result)) {
          this.logger.info(
            'Successfully migrated %d cached images',
            result.length,
          );
        }
      } catch (e) {
        this.logger.error('Unable to migrate cached images', e);
      }
    }

    return await this.settings
      .directUpdate((existingSettings) => {
        return {
          ...existingSettings,
          settings: settings as Required<Settings>,
          migration: {
            ...existingSettings.migration,
            legacyMigration: true,
          },
        };
      })
      .then(() => {
        this.logger.info('Completed legacy migration from dizquetv');
      });
  }

  private async readAllOldDbFile(
    legacyDbPath: string,
    file: string,
  ): Promise<JSONArray | JSONObject> {
    // We make an assumption about the location of the legacy db file, because
    // we know how the server discovered it...
    const data = await fs.readFile(path.join(legacyDbPath, file + '.json'));
    const str = data.toString('utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(str);
    return isArray(parsed) ? (parsed as JSONArray) : (parsed as JSONObject);
  }

  private async readOldDbFile(
    legacyDbPath: string,
    file: string,
  ): Promise<JSONObject> {
    const data = await this.readAllOldDbFile(legacyDbPath, file);
    if (isArray(data)) {
      return data[0] as JSONObject;
    } else {
      return data;
    }
  }

  private async migrateCachedImages(legacyDbPath: string) {
    const cacheImages = (await this.readAllOldDbFile(
      legacyDbPath,
      'cache-images',
    )) as JSONObject[];
    const newCacheImages: NewCachedImage[] = [];
    for (const cacheImage of cacheImages) {
      // Extract the original URL
      const url = Buffer.from(cacheImage['url'] as string, 'base64').toString(
        'utf-8',
      );
      const hash = cacheImage['url'] as string;
      const mimeType = cacheImage['mimeType'] as Maybe<string>;
      newCacheImages.push({ url, hash, mimeType });
    }

    return this.db
      .insertInto('cachedImage')
      .values(newCacheImages)
      .onConflict((oc) =>
        oc.doUpdateSet((eb) => ({
          mimeType: eb.ref('excluded.mimeType'),
          url: eb.ref('excluded.url'),
        })),
      )
      .execute();
  }
}
