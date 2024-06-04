import {
  FfmpegSettings,
  PlexServerSettings,
  PlexStreamSettings,
  defaultFfmpegSettings,
  defaultHdhrSettings,
  defaultPlexStreamSettings,
} from '@tunarr/types';
import {
  DefaultVideoFormat,
  DefaultHardwareAccel,
  SupportedHardwareAccels,
  SupportedVideoFormats,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import fs from 'fs/promises';
import {
  find,
  isArray,
  isEmpty,
  isError,
  isNaN,
  isNil,
  isNumber,
  isObject,
  isUndefined,
  map,
  merge,
  mergeWith,
  parseInt,
  sortBy,
} from 'lodash-es';
import path from 'path';
import { PlexApiFactory } from '../../external/plex.js';
import { globalOptions } from '../../globals.js';
import { serverContext } from '../../serverContext.js';
import { GlobalScheduler } from '../../services/scheduler.js';
import { AnonymousTask } from '../../tasks/Task.js';
import { Maybe } from '../../types/util.js';
import { attempt } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { EntityManager, withDb } from '../dataSource.js';
import { CachedImage } from '../entities/CachedImage.js';
import { PlexServerSettings as PlexServerSettingsEntity } from '../entities/PlexServerSettings.js';
import { Settings, SettingsDB, defaultXmlTvSettings } from '../settings.js';
import {
  LegacyChannelMigrator,
  LegacyProgram,
} from './LegacyChannelMigrator.js';
import { LegacyLibraryMigrator } from './libraryMigrator.js';
import { LegacyMetadataBackfiller } from './metadataBackfill.js';
import {
  JSONArray,
  JSONObject,
  JSONValue,
  tryParseResolution,
  tryStringSplitOrDefault,
} from './migrationUtil.js';

// Mapping from the old web UI
const maxAudioChannelsOptions = [
  { oldValue: '1', newValue: '1.0' },
  { oldValue: '2', newValue: '2.0' },
  { oldValue: '3', newValue: '2.1' },
  { oldValue: '4', newValue: '4.0' },
  { oldValue: '5', newValue: '5.0' },
  { oldValue: '6', newValue: '5.1' },
  { oldValue: '7', newValue: '6.1' },
  { oldValue: '8', newValue: '7.1' },
];

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

function parseIntOrDefault(s: JSONValue, defaultValue: number): number {
  const sOrN = s as Maybe<string | number>;
  if (isUndefined(sOrN)) return defaultValue;
  if (isNumber(sOrN)) return sOrN;
  const parsed = parseInt(sOrN);
  return isNaN(parsed) ? defaultValue : parsed;
}

export class LegacyDbMigrator {
  private logger = LoggerFactory.child({ caller: import.meta });

  constructor(
    private settings: SettingsDB,
    private legacyDbPath: string,
  ) {}

  migrateFromLegacyDb(entities?: string[]) {
    return withDb((em) => this.migrateFromLegacyDbInner(em, entities));
  }

  private async migrateFromLegacyDbInner(
    em: EntityManager,
    entities?: string[],
  ) {
    const entitiesToMigrate = entities ?? MigratableEntities;
    // First initialize the default schema:
    // db.data = { ...defaultSchema(globalOptions().databaseDirectory) };
    // await db.write();

    let settings: Partial<Settings> = {};
    if (entitiesToMigrate.includes('hdhr')) {
      try {
        const hdhrSettings = await attempt(() =>
          this.readOldDbFile('hdhr-settings'),
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
          this.readOldDbFile('xmltv-settings'),
        );
        if (isError(xmltvSettings)) {
          settings = {
            ...settings,
            xmltv: {
              ...defaultXmlTvSettings(globalOptions().databaseDirectory),
            },
          };
        } else {
          this.logger.debug('Migrating XMLTV settings', xmltvSettings);
          settings = {
            ...settings,
            xmltv: {
              enableImageCache: xmltvSettings['enableImageCache'] as boolean,
              outputPath: xmltvSettings['file'] as string,
              programmingHours: xmltvSettings['cache'] as number,
              refreshHours: xmltvSettings['refresh'] as number,
            },
          };
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate XMLTV settings');
      }
    }

    if (entitiesToMigrate.includes('plex')) {
      try {
        const plexSettings = await attempt(() =>
          this.readOldDbFile('plex-settings'),
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
          const audioChannelValue = plexSettings[
            'maxAudioChannels'
          ] as Maybe<string>;
          const newAudioChannelValue = !isNil(audioChannelValue)
            ? find(maxAudioChannelsOptions, { newValue: audioChannelValue })
                ?.newValue ?? '2.0'
            : '2.0';
          settings = {
            ...settings,
            plexStream: mergeWith<
              Partial<PlexStreamSettings>,
              PlexStreamSettings
            >(
              {
                audioBoost: parseIntOrDefault(
                  plexSettings['audioBoost'],
                  defaultPlexStreamSettings.audioBoost,
                ),
                audioCodecs: tryStringSplitOrDefault(
                  plexSettings['audioCodecs'] as Maybe<string>,
                  ',',
                  defaultPlexStreamSettings.audioCodecs,
                ),
                directStreamBitrate: parseIntOrDefault(
                  plexSettings['directStreamBitrate'],
                  defaultPlexStreamSettings.directStreamBitrate,
                ),
                transcodeBitrate: parseIntOrDefault(
                  plexSettings['transcodeBitrate'],
                  defaultPlexStreamSettings.transcodeBitrate,
                ),
                mediaBufferSize: plexSettings[
                  'mediaBufferSize'
                ] as Maybe<number>,
                enableDebugLogging: plexSettings[
                  'debugLogging'
                ] as Maybe<boolean>,
                enableSubtitles: plexSettings[
                  'enableSubtitles'
                ] as Maybe<boolean>,
                forceDirectPlay: plexSettings[
                  'forceDirectPlay'
                ] as Maybe<boolean>,
                maxAudioChannels: newAudioChannelValue,
                maxPlayableResolution:
                  tryParseResolution(
                    plexSettings['maxPlayableResolution'] as Maybe<string>,
                  ) ?? defaultPlexStreamSettings.maxPlayableResolution,
                maxTranscodeResolution:
                  tryParseResolution(
                    plexSettings['maxTranscodeResolution'] as Maybe<string>,
                  ) ?? defaultPlexStreamSettings.maxTranscodeResolution,
                pathReplace: plexSettings['pathReplace'] as Maybe<string>,
                pathReplaceWith: plexSettings[
                  'pathReplaceWith'
                ] as Maybe<string>,
                streamPath: plexSettings['streamPath'] as Maybe<
                  'plex' | 'direct'
                >,
                streamProtocol: plexSettings['streamProtocol'] as Maybe<string>,
                subtitleSize: parseIntOrDefault(
                  plexSettings['subtitleSize'],
                  defaultPlexStreamSettings.subtitleSize,
                ),
                transcodeMediaBufferSize:
                  plexSettings.transcodeMediaBufferSize as Maybe<number>,
                updatePlayStatus:
                  plexSettings.updatePlayStatus as Maybe<boolean>,
                videoCodecs: tryStringSplitOrDefault(
                  plexSettings.videoCodecs as Maybe<string>,
                  ',',
                  defaultPlexStreamSettings.videoCodecs,
                ),
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
        this.readAllOldDbFile('plex-servers'),
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

          const entities = migratedServers.map((server) => {
            const pss = new PlexServerSettingsEntity();
            pss.name = server.name;
            pss.accessToken = server.accessToken;
            pss.uri = server.uri;
            pss.sendChannelUpdates = server.sendChannelUpdates;
            pss.sendGuideUpdates = server.sendGuideUpdates;
            pss.index = server.index;
            return pss;
          });

          // Don't bother filling in the client_identifier here, the Fixer
          // will take care of that -- we may want to do it here if we want
          // to remove the fixer eventually, though.
          for (const entity of entities) {
            const plexApi = PlexApiFactory.get(entity);
            const status = await plexApi.checkServerStatus();
            if (status === 1) {
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

          await em.upsertMany(PlexServerSettingsEntity, entities, {
            onConflictFields: ['name', 'uri'],
            onConflictAction: 'ignore',
          });
          await em.persistAndFlush(entities);
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate Plex server settings');
      }
    }

    if (entitiesToMigrate.includes('ffmpeg')) {
      try {
        const ffmpegSettings = await attempt(
          async () => await this.readOldDbFile('ffmpeg-settings'),
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

          settings = {
            ...settings,
            ffmpeg: merge<FfmpegSettings, FfmpegSettings>(
              {
                configVersion: ffmpegSettings['configVersion'] as number,
                ffmpegExecutablePath: ffmpegSettings['ffmpegPath'] as string,
                numThreads: ffmpegSettings['threads'] as number,
                concatMuxDelay: ffmpegSettings['concatMuxDelay'] as number,
                enableLogging: ffmpegSettings['logFfmpeg'] as boolean,
                // This is ignored now
                enableTranscoding: true,
                audioVolumePercent: ffmpegSettings[
                  'audioVolumePercent'
                ] as number,
                videoEncoder: ffmpegSettings['videoEncoder'] as string,
                videoFormat,
                hardwareAccelerationMode: hwAccel,
                audioEncoder: ffmpegSettings['audioEncoder'] as string,
                targetResolution:
                  tryParseResolution(
                    ffmpegSettings['targetResolution'] as string,
                  ) ?? defaultFfmpegSettings.targetResolution,
                videoBitrate: ffmpegSettings['videoBitrate'] as number,
                videoBufferSize: ffmpegSettings['videoBufSize'] as number,
                audioBitrate: ffmpegSettings['audioBitrate'] as number,
                audioBufferSize: ffmpegSettings['audioBufSize'] as number,
                audioSampleRate: ffmpegSettings['audioSampleRate'] as number,
                audioChannels: ffmpegSettings['audioChannels'] as number,
                errorScreen: ffmpegSettings['errorScreen'] as string,
                errorAudio: ffmpegSettings['errorAudio'] as string,
                normalizeVideoCodec: ffmpegSettings[
                  'normalizeVideoCodec'
                ] as boolean,
                normalizeAudioCodec: ffmpegSettings[
                  'normalizeAudioCodec'
                ] as boolean,
                normalizeResolution: ffmpegSettings[
                  'normalizeResolution'
                ] as boolean,
                normalizeAudio: ffmpegSettings['normalizeAudio'] as boolean,
                maxFPS: ffmpegSettings['maxFPS'] as number,
                scalingAlgorithm: ffmpegSettings[
                  'scalingAlgorithm'
                ] as (typeof defaultFfmpegSettings)['scalingAlgorithm'],
                deinterlaceFilter: ffmpegSettings[
                  'deinterlaceFilter'
                ] as (typeof defaultFfmpegSettings)['deinterlaceFilter'],
                disableChannelOverlay: ffmpegSettings[
                  'disableChannelOverlay'
                ] as (typeof defaultFfmpegSettings)['disableChannelOverlay'],
                disableChannelPrelude:
                  (ffmpegSettings['disablePreludes'] as Maybe<boolean>) ??
                  false,
              },
              defaultFfmpegSettings,
            ),
          };
        }
      } catch (e) {
        this.logger.error(e, 'Unable to migrate ffmpeg settings');
      }
    }

    try {
      this.logger.debug('Migrating client ID');
      const clientId = await this.readOldDbFile('client-id');
      settings = {
        ...settings,
        clientId: clientId['clientId'] as string,
      };
    } catch (e) {
      this.logger.error(e, 'Unable to migrate client ID');
    }

    const libraryMigrator = new LegacyLibraryMigrator();

    if (entitiesToMigrate.includes('custom-shows')) {
      try {
        this.logger.debug('Migrating custom shows');
        await libraryMigrator.migrateCustomShows(
          this.legacyDbPath,
          'custom-shows',
        );
      } catch (e) {
        this.logger.error(e, 'Unable to migrate all custom shows');
      }
    }

    if (entitiesToMigrate.includes('filler-shows')) {
      try {
        this.logger.debug('Migrating filler shows');
        await libraryMigrator.migrateCustomShows(this.legacyDbPath, 'filler');
      } catch (e) {
        this.logger.error(e, 'Unable to migrate all filler shows');
      }
    }

    if (entitiesToMigrate.includes('channels')) {
      try {
        this.logger.debug('Migraing channels...');
        await new LegacyChannelMigrator().migrateChannels(this.legacyDbPath);
        // Finish this process in the background, since it could take a while
        GlobalScheduler.scheduleOneOffTask(
          'BackfillParentMetadata',
          dayjs().add(10, 'seconds').toDate(),
          AnonymousTask('BackfillParentMetadata', async () => {
            serverContext().eventService.push({
              type: 'lifecycle',
              detail: {
                time: new Date().getTime(),
              },
              message:
                'Background metadata backfill in progress. Please be patient!',
              level: 'info',
            });
            return new LegacyMetadataBackfiller().backfillParentMetadata();
          }),
        );
      } catch (e) {
        this.logger.error(e, 'Unable to migrate channels');
      }
    }

    if (entitiesToMigrate.includes('cached-images')) {
      try {
        this.logger.debug('Migrating cached images');
        const result = await this.migrateCachedImages();
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
    file: string,
  ): Promise<JSONArray | JSONObject> {
    // We make an assumption about the location of the legacy db file, because
    // we know how the server discovered it...
    const data = await fs.readFile(
      path.join(this.legacyDbPath, file + '.json'),
    );
    const str = data.toString('utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(str);
    return isArray(parsed) ? (parsed as JSONArray) : (parsed as JSONObject);
  }

  private async readOldDbFile(file: string): Promise<JSONObject> {
    const data = await this.readAllOldDbFile(file);
    if (isArray(data)) {
      return data[0] as JSONObject;
    } else {
      return data;
    }
  }

  private async migrateCachedImages() {
    return withDb(async (em) => {
      const repo = em.getRepository(CachedImage);
      const cacheImages = (await this.readAllOldDbFile(
        'cache-images',
      )) as JSONObject[];
      const newCacheImages: CachedImage[] = [];
      for (const cacheImage of cacheImages) {
        // Extract the original URL
        const url = Buffer.from(cacheImage['url'] as string, 'base64').toString(
          'utf-8',
        );
        const hash = cacheImage['url'] as string;
        const mimeType = cacheImage['mimeType'] as Maybe<string>;
        newCacheImages.push({ url, hash, mimeType });
      }
      return repo.upsertMany(newCacheImages);
    });
  }
}
