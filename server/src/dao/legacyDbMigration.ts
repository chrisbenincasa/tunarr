import {
  FfmpegSettings,
  PlexServerSettings,
  PlexStreamSettings,
  defaultFfmpegSettings,
  defaultHdhrSettings,
  defaultPlexStreamSettings,
} from '@tunarr/types';
import fs from 'fs/promises';
import {
  find,
  isArray,
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
import { Low } from 'lowdb';
import path from 'path';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import { attempt } from '../util/index.js';
import { EntityManager, withDb } from './dataSource.js';
import { CachedImage } from './entities/CachedImage.js';
import { PlexServerSettings as PlexServerSettingsEntity } from './entities/PlexServerSettings.js';
import {
  LegacyProgram,
  migrateChannels,
} from './legacy_migration/channelMigrator.js';
import { migrateCustomShows } from './legacy_migration/libraryMigrator.js';
import {
  JSONArray,
  JSONObject,
  JSONValue,
  tryParseResolution,
  tryStringSplitOrDefault,
} from './legacy_migration/migrationUtil.js';
import {
  Schema,
  SettingsSchema,
  defaultSchema,
  defaultXmlTvSettings,
} from './settings.js';

export const logger = createLogger(import.meta);

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

async function readAllOldDbFile(file: string): Promise<JSONArray | JSONObject> {
  // We make an assumption about the location of the legacy db file, because
  // we know how the server discovered it...
  const data = await fs.readFile(
    path.join(process.cwd(), '.dizquetv', file + '.json'),
  );
  const str = data.toString('utf-8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed = JSON.parse(str);
  return isArray(parsed) ? (parsed as JSONArray) : (parsed as JSONObject);
}

async function readOldDbFile(file: string): Promise<JSONObject> {
  const data = await readAllOldDbFile(file);
  if (isArray(data)) {
    return data[0] as JSONObject;
  } else {
    return data;
  }
}

function parseIntOrDefault(s: JSONValue, defaultValue: number): number {
  const sOrN = s as Maybe<string | number>;
  if (isUndefined(sOrN)) return defaultValue;
  if (isNumber(sOrN)) return sOrN;
  const parsed = parseInt(sOrN);
  return isNaN(parsed) ? defaultValue : parsed;
}

export type CustomShow = {
  id: string;
  name: string;
  content: LegacyProgram[];
};

async function migrateCachedImages() {
  return withDb(async (em) => {
    const repo = em.getRepository(CachedImage);
    const cacheImages = (await readAllOldDbFile(
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

export const migrateFromLegacyDb = (
  settings: Low<Schema>,
  entities?: string[],
) => withDb((em) => migrateFromLegacyDbInner(em, settings, entities));

async function migrateFromLegacyDbInner(
  em: EntityManager,
  db: Low<Schema>,
  entities?: string[],
) {
  const entitiesToMigrate = entities ?? MigratableEntities;
  // First initialize the default schema:
  db.data = { ...defaultSchema(globalOptions().databaseDirectory) };
  await db.write();

  let settings: Partial<SettingsSchema> = {};
  if (entitiesToMigrate.includes('hdhr')) {
    try {
      const hdhrSettings = await attempt(() => readOldDbFile('hdhr-settings'));
      if (isError(hdhrSettings)) {
        settings = {
          ...settings,
          hdhr: {
            ...defaultHdhrSettings,
          },
        };
      } else {
        logger.debug('Migrating HDHR settings', hdhrSettings);
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
      logger.error('Unable to migrate HDHR settings', e);
    }
  }

  if (entitiesToMigrate.includes('xmltv')) {
    try {
      const xmltvSettings = await attempt(() =>
        readOldDbFile('xmltv-settings'),
      );
      if (isError(xmltvSettings)) {
        settings = {
          ...settings,
          xmltv: {
            ...defaultXmlTvSettings(globalOptions().databaseDirectory),
          },
        };
      } else {
        logger.debug('Migrating XMLTV settings', xmltvSettings);
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
      logger.error('Unable to migrate XMLTV settings', e);
    }
  }

  if (entitiesToMigrate.includes('plex')) {
    try {
      const plexSettings = await attempt(() => readOldDbFile('plex-settings'));
      if (isError(plexSettings)) {
        settings = {
          ...settings,
          plexStream: {
            ...defaultPlexStreamSettings,
          },
        };
      } else {
        logger.debug('Migrating Plex settings', plexSettings);
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
              mediaBufferSize: plexSettings['mediaBufferSize'] as Maybe<number>,
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
              pathReplaceWith: plexSettings['pathReplaceWith'] as Maybe<string>,
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
              updatePlayStatus: plexSettings.updatePlayStatus as Maybe<boolean>,
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
      logger.error('Unable to migrate Plex settings', e);
    }
  }

  if (entitiesToMigrate.includes('plex-servers')) {
    const plexServers = await attempt(() => readAllOldDbFile('plex-servers'));
    try {
      if (!isError(plexServers)) {
        logger.debug('Migrating Plex servers', plexServers);
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

        await em.upsertMany(PlexServerSettingsEntity, entities, {
          onConflictFields: ['name', 'uri'],
          onConflictAction: 'ignore',
        });
        await em.persistAndFlush(entities);
      }
    } catch (e) {
      logger.error('Unable to migrate Plex server settings', e);
    }
  }

  if (entitiesToMigrate.includes('ffmpeg')) {
    try {
      const ffmpegSettings = await attempt(
        async () => await readOldDbFile('ffmpeg-settings'),
      );
      if (isError(ffmpegSettings)) {
        settings = {
          ...settings,
          ffmpeg: {
            ...defaultFfmpegSettings,
          },
        };
      } else {
        logger.debug('Migrating ffmpeg settings', ffmpegSettings);
        settings = {
          ...settings,
          ffmpeg: merge<FfmpegSettings, FfmpegSettings>(
            {
              configVersion: ffmpegSettings['configVersion'] as number,
              ffmpegExecutablePath: ffmpegSettings['ffmpegPath'] as string,
              numThreads: ffmpegSettings['threads'] as number,
              concatMuxDelay: ffmpegSettings['concatMuxDelay'] as number,
              enableLogging: ffmpegSettings['logFfmpeg'] as boolean,
              enableTranscoding: ffmpegSettings[
                'enableFFMPEGTranscoding'
              ] as boolean,
              audioVolumePercent: ffmpegSettings[
                'audioVolumePercent'
              ] as number,
              videoEncoder: ffmpegSettings['videoEncoder'] as string,
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
                (ffmpegSettings['disablePreludes'] as Maybe<boolean>) ?? false,
            },
            defaultFfmpegSettings,
          ),
        };
      }
    } catch (e) {
      logger.error('Unable to migrate ffmpeg settings', e);
    }
  }

  try {
    logger.debug('Migrating client ID');
    const clientId = await readOldDbFile('client-id');
    settings = {
      ...settings,
      clientId: clientId['clientId'] as string,
    };
  } catch (e) {
    logger.error('Unable to migrate client ID', e);
  }

  if (entitiesToMigrate.includes('custom-shows')) {
    try {
      logger.debug('Migrating custom shows');
      await migrateCustomShows(
        path.join(process.cwd(), '.dizquetv'),
        'custom-shows',
      );
    } catch (e) {
      logger.error('Unable to migrate all custom shows', e);
    }
  }

  if (entitiesToMigrate.includes('filler-shows')) {
    try {
      logger.debug('Migrating filler shows');
      await migrateCustomShows(path.join(process.cwd(), '.dizquetv'), 'filler');
    } catch (e) {
      logger.error('Unable to migrate all filler shows', e);
    }
  }

  if (entitiesToMigrate.includes('channels')) {
    try {
      logger.debug('Migraing channels...');
      await migrateChannels(path.join(process.cwd(), '.dizquetv'));
    } catch (e) {
      logger.error('Unable to migrate channels', e);
    }
  }

  if (entitiesToMigrate.includes('cached-images')) {
    try {
      logger.debug('Migrating cached images');
      await migrateCachedImages();
    } catch (e) {
      logger.error('Unable to migrate cached images', e);
    }
  }

  db.data.settings = settings as Required<SettingsSchema>;
  db.data.migration.legacyMigration = true;
  return await db.write();
}
