import { promises as fsPromises } from 'fs';
import {
  get,
  isArray,
  isNaN,
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
import {
  CachedImage,
  Channel,
  CustomShow,
  FfmpegSettings,
  PlexServerSettings,
  PlexStreamSettings,
  Program,
  ProgramType,
  Resolution,
  Schema,
  Settings,
  defaultFfmpegSettings,
  defaultPlexStreamSettings,
  defaultSchema,
} from './db.js';
import { Maybe } from '../types.js';

type LegacyPlexSettings = {
  streamPath: string;
  debugLogging: boolean;
  directStreamBitrate: number;
  transcodeBitrate: number;
  mediaBufferSize: number;
  transcodeMediaBufferSize: number;
  maxPlayableResolution: string;
  maxTranscodeResolution: string;
  videoCodecs: string;
  audioCodecs: string;
  maxAudioChannels: string;
  audioBoost: string;
  enableSubtitles: boolean;
  subtitleSize: string;
  updatePlayStatus: boolean;
  streamProtocol: string;
  forceDirectPlay: boolean;
  pathReplace: string;
  pathReplaceWith: string;
};

const logger = createLogger(import.meta);

async function readAllOldDbFile(file: string): Promise<JSONArray | JSONObject> {
  try {
    const data = await fsPromises.readFile(
      path.resolve(globalOptions().database, file + '.json'),
    );
    const str = data.toString('utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(str);
    return isArray(parsed) ? (parsed as JSONArray) : (parsed as JSONObject);
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

async function readOldDbFile(file: string): Promise<JSONObject> {
  try {
    const data = await readAllOldDbFile(file);
    if (isArray(data)) {
      return data[0] as JSONObject;
    } else {
      return data;
    }
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

function parseIntOrDefault(s: string, defaultValue: number): number {
  const parsed = parseInt(s);
  return isNaN(parsed) ? defaultValue : parsed;
}

function tryStringSplitOrDefault(
  s: string | undefined,
  delim: string,
  defaultValue: string[],
): string[] {
  return s?.split(delim) ?? defaultValue;
}

function tryParseResolution(s: string | undefined): Resolution | undefined {
  if (isUndefined(s)) {
    return undefined;
  }

  const parts = s.split('x', 2);
  if (parts.length < 2) {
    return undefined;
  }

  const x = parseInt(parts[0]);
  const y = parseInt(parts[1]);

  if (isNaN(x) || isNaN(y)) {
    return undefined;
  }

  return {
    widthPx: x,
    heightPx: y,
  };
}

function emptyStringToUndefined(s: string | undefined): string | undefined {
  if (isUndefined(s)) {
    return s;
  }

  return s.length === 0 ? undefined : s;
}

interface JSONArray extends Array<JSONValue> {}

type JSONValue = string | number | undefined | boolean | JSONObject | JSONArray;

interface JSONObject extends Record<string, JSONValue> {}

function convertProgram(program: JSONObject): Program {
  const isMovie = (program['type'] as string) === 'movie';
  return {
    duration: program['duration'] as number,
    episodeIcon: program['episodeIcon'] as Maybe<string>,
    file: program['file'] as string,
    icon: program['icon'] as string,
    key: program['key'] as string,
    plexFile: program['plexFile'] as string,
    ratingKey: program['ratingKey'] as string,
    serverKey: program['serverKey'] as string,
    showTitle: program['showTitle'] as Maybe<string>,
    summary: program['summary'] as string,
    title: program['title'] as string,
    type: program['type'] as ProgramType,
    episode: isMovie ? undefined : (program['episode'] as Maybe<number>),
    season: isMovie ? undefined : (program['season'] as Maybe<number>),
    seasonIcon: isMovie ? undefined : (program['seasonIcon'] as Maybe<string>),
    // showId: program['showId'] as string,
    showIcon: isMovie ? undefined : (program['showIcon'] as Maybe<string>),
    date: program['date'] as string,
    rating: program['rating'] as string,
    year: program['year'] as number,
    channel: program['channel'] as number,
    isOffline: (program['isOffline'] as Maybe<boolean>) ?? false,
    customOrder: program['customOrder'] as Maybe<number>,
    customShowId: program['customShowId'] as Maybe<string>,
    customShowName: program['customShowName'] as Maybe<string>,
  };
}

async function migrateChannels(db: Low<Schema>) {
  const channelFiles = await fsPromises.readdir(
    path.resolve(globalOptions().database, 'channels'),
  );

  async function migrateChannel(file: string): Promise<Channel> {
    logger.debug('Migrating channel: ' + file);
    const channel = await fsPromises.readFile(
      path.join(path.resolve(globalOptions().database, 'channels'), file),
    );
    const parsed = JSON.parse(channel.toString('utf-8')) as JSONObject;

    const transcodingOptions = get(
      parsed,
      'transcoding.targetResolution',
    ) as string;
    const hasTranscodingOptions = !isUndefined(
      emptyStringToUndefined(transcodingOptions),
    );

    const watermark = parsed['watermark'] as JSONObject;

    // const toIcon(obj: JSONObject)

    return {
      disableFillerOverlay: parsed['disableFillerOverlay'] as boolean,
      duration: parsed['duration'] as number,
      fallback: ((parsed['fallback'] as Maybe<JSONArray>) ?? []).map(
        convertProgram,
      ),
      groupTitle: parsed['groupTitle'] as string,
      guideMinimumDurationSeconds: parsed[
        'guideMinimumDurationSeconds'
      ] as number,
      icon: {
        path: parsed['icon'] as string,
        duration: parsed['iconDuration'] as number,
        position: parsed['iconPosition'] as string,
        width: parsed['iconWidth'] as number,
      },
      startTimeEpoch: new Date(parsed['startTime'] as string).getTime(),
      name: parsed['name'] as string,
      offline: {
        picture: parsed['offlinePicture'] as string,
        soundtrack: emptyStringToUndefined(
          parsed['offlineSoundtrack'] as string,
        ),
        mode: parsed['offlineMode'] as 'clip' | 'pic',
      },
      transcoding:
        hasTranscodingOptions &&
        !isUndefined(tryParseResolution(transcodingOptions))
          ? {
              targetResolution: tryParseResolution(transcodingOptions)!,
            }
          : undefined,
      programs: ((parsed['programs'] as JSONArray) ?? []).map(convertProgram),
      number: parsed['number'] as number,
      fillerCollections: ((parsed['fillerCollections'] as JSONArray) ?? []).map(
        (fc) => {
          return {
            id: fc!['id'] as string,
            weight: fc!['weight'] as number,
            cooldownSeconds: fc!['cooldown'] / 1000,
          };
        },
      ),
      watermark: !isUndefined(watermark)
        ? {
            enabled: watermark['enabled'] as boolean,
            duration: watermark['duration'] as number,
            position: watermark['position'] as string,
            width: watermark['width'] as number,
            verticalMargin: watermark['verticalMargin'] as number,
            horizontalMargin: watermark['horizontalMargin'] as number,
            url: watermark['url'] as Maybe<string>,
            animated: isUndefined(watermark['animated'])
              ? false
              : (watermark['animated'] as boolean),
            fixedSize: watermark['fixedSize'] as boolean,
          }
        : undefined,
      stealth: isUndefined(parsed['stealth'])
        ? false
        : (parsed['stealth'] as boolean),
      guideFlexPlaceholder: emptyStringToUndefined(
        parsed['guideFlexPlaceholder'] as string,
      ),
    };
  }

  const newChannels = await channelFiles.reduce(
    async (prev, file) => {
      return [...(await prev), await migrateChannel(file)];
    },
    Promise.resolve([] as Channel[]),
  );

  db.data.channels = newChannels;
  return db.write();
}

async function migrateCustomShows(db: Low<Schema>) {
  const channelFiles = await fsPromises.readdir(
    path.resolve(globalOptions().database, 'custom-shows'),
  );

  const newCustomShows = await channelFiles.reduce(
    async (prev, file) => {
      const id = file.replace('.json', '');
      logger.debug('Migrating custom show: ' + file);
      const channel = await fsPromises.readFile(
        path.join(path.resolve(globalOptions().database, 'custom-shows'), file),
      );
      const parsed = JSON.parse(channel.toString('utf-8')) as JSONObject;

      const show: CustomShow = {
        id,
        name: parsed['name'] as string,
        content: (parsed['content'] as JSONArray).map(convertProgram),
      };
      return [...(await prev), show];
    },
    Promise.resolve([] as CustomShow[]),
  );

  db.data.customShows = newCustomShows;
  return db.write();
}

async function migrateCachedImages(db: Low<Schema>) {
  const cacheImages = (await readAllOldDbFile('cache-images')) as JSONObject[];
  const newCacheImages: CachedImage[] = [];
  for (const cacheImage of cacheImages) {
    // Extract the original URL
    const url = Buffer.from(cacheImage['url'] as string, 'base64').toString(
      'utf-8',
    );
    const hash = cacheImage['url'] as string;
    const mimeType = cacheImage['mimeType'] as string;
    newCacheImages.push({ url, hash, mimeType });
  }
  db.data.cachedImages = newCacheImages;
  return db.write();
}

export async function migrateFromLegacyDb(db: Low<Schema>) {
  // First initialize the default schema:
  db.data = { ...defaultSchema };
  await db.write();

  let settings: Partial<Settings> = {};
  try {
    const hdhrSettings = await readOldDbFile('hdhr-settings');
    logger.debug('Migrating HDHR settings', hdhrSettings);
    settings = {
      ...settings,
      hdhr: {
        autoDiscoveryEnabled:
          (hdhrSettings['autoDiscovery'] as Maybe<boolean>) ?? true,
        tunerCount: (hdhrSettings['tunerCount'] as Maybe<number>) ?? 2,
      },
    };
  } catch (e) {
    logger.error('Unable to migrate HDHR settings', e);
  }

  try {
    const xmltvSettings = await readOldDbFile('xmltv-settings');
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
  } catch (e) {
    logger.error('Unable to migrate XMLTV settings', e);
  }

  try {
    const plexSettings = (await readOldDbFile(
      'plex-settings',
    )) as LegacyPlexSettings;
    logger.debug('Migrating Plex settings', plexSettings);
    settings = {
      ...settings,
      plexStream: mergeWith<PlexStreamSettings, PlexStreamSettings>(
        {
          audioBoost: parseIntOrDefault(
            plexSettings['audioBoost'],
            defaultPlexStreamSettings.audioBoost,
          ),
          audioCodecs: tryStringSplitOrDefault(
            plexSettings['audioCodecs'],
            ',',
            defaultPlexStreamSettings.audioCodecs,
          ),
          directStreamBitrate: plexSettings['directStreamBitrate'],
          transcodeBitrate: plexSettings['transcodeBitrate'],
          mediaBufferSize: plexSettings['mediaBufferSize'],
          enableDebugLogging: plexSettings['debugLogging'],
          enableSubtitles: plexSettings['enableSubtitles'],
          forceDirectPlay: plexSettings['forceDirectPlay'],
          maxAudioChannels: parseIntOrDefault(
            plexSettings['maxAudioChannels'],
            defaultPlexStreamSettings.maxAudioChannels,
          ),
          maxPlayableResolution:
            tryParseResolution(plexSettings['maxPlayableResolution']) ??
            defaultPlexStreamSettings.maxPlayableResolution,
          maxTranscodeResolution:
            tryParseResolution(plexSettings['maxTranscodeResolution']) ??
            defaultPlexStreamSettings.maxTranscodeResolution,
          pathReplace: plexSettings['pathReplace'],
          pathReplaceWith: plexSettings['pathReplaceWith'],
          streamPath: plexSettings['streamPath'],
          streamProtocol: plexSettings['streamProtocol'],
          subtitleSize: parseIntOrDefault(
            plexSettings['subtitleSize'],
            defaultPlexStreamSettings.subtitleSize,
          ),
          transcodeMediaBufferSize: plexSettings.transcodeMediaBufferSize,
          updatePlayStatus: plexSettings.updatePlayStatus,
          videoCodecs: tryStringSplitOrDefault(
            plexSettings.videoCodecs,
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
  } catch (e) {
    logger.error('Unable to migrate Plex settings', e);
  }

  try {
    const plexServers = await readAllOldDbFile('plex-servers');
    logger.info('Migrating Plex servers', plexServers);
    let servers: JSONObject[] = [];
    if (isArray(plexServers)) {
      servers = [...plexServers] as JSONObject[];
    } else if (isObject(plexServers)) {
      servers = [plexServers];
    }
    const migratedServers: PlexServerSettings[] = sortBy(
      map(servers, (server) => {
        return {
          id: server['id'],
          name: server['name'],
          uri: server['uri'],
          accessToken: server['accessToken'],
          sendChannelUpdates: server['arChannels'],
          sendGuideUpdates: server['arGuide'],
          index: server['index'],
        } as PlexServerSettings;
      }),
      'index',
    );
    settings = {
      ...settings,
      plexServers: migratedServers,
    };
  } catch (e) {
    logger.error('Unable to migrate Plex server settings', e);
  }

  try {
    const ffmpegSettings = readOldDbFile('ffmpeg-settings');
    logger.debug('Migrating ffmpeg settings', ffmpegSettings);
    settings = {
      ...settings,
      ffmpeg: merge<FfmpegSettings, FfmpegSettings>(
        {
          configVersion: ffmpegSettings['configVersion'] as number,
          ffmpegExecutablePath: ffmpegSettings['ffmpegPath'] as string,
          numThreads: ffmpegSettings['threads'] as number,
          concatMuxDelay: ffmpegSettings['concatMuxDelay'] as string,
          enableLogging: ffmpegSettings['logFfmpeg'] as boolean,
          enableTranscoding: ffmpegSettings[
            'enableFFMPEGTranscoding'
          ] as boolean,
          audioVolumePercent: ffmpegSettings['audioVolumePercent'] as number,
          videoEncoder: ffmpegSettings['videoEncoder'] as string,
          audioEncoder: ffmpegSettings['audioEncoder'] as string,
          targetResolution:
            tryParseResolution(ffmpegSettings['targetResolution'] as string) ??
            defaultFfmpegSettings.targetResolution,
          videoBitrate: ffmpegSettings['videoBitrate'] as number,
          videoBufferSize: ffmpegSettings['videoBufSize'] as number,
          audioBitrate: ffmpegSettings['audioBitrate'] as number,
          audioBufferSize: ffmpegSettings['audioBufSize'] as number,
          audioSampleRate: ffmpegSettings['audioSampleRate'] as number,
          audioChannels: ffmpegSettings['audioChannels'] as number,
          errorScreen: ffmpegSettings['errorScreen'] as string,
          errorAudio: ffmpegSettings['errorAudio'] as string,
          normalizeVideoCodec: ffmpegSettings['normalizeVideoCodec'] as boolean,
          normalizeAudioCodec: ffmpegSettings['normalizeAudioCodec'] as boolean,
          normalizeResolution: ffmpegSettings['normalizeResolution'] as boolean,
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
        },
        defaultFfmpegSettings,
      ),
    };
  } catch (e) {
    logger.error('Unable to migrate ffmpeg settings', e);
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

  try {
    logger.debug('Migraing channels...');
    await migrateChannels(db);
  } catch (e) {
    logger.error('Unable to migrate channels', e);
  }

  try {
    logger.debug('Migrating custom shows');
    await migrateCustomShows(db);
  } catch (e) {
    logger.error('Unable to migrate all custom shows', e);
  }

  try {
    logger.debug('Migrating cached images');
    await migrateCachedImages(db);
  } catch (e) {
    logger.error('Unable to migrate cached images', e);
  }

  // TODO migrate fillerLists

  db.data.settings = settings as Required<Settings>;
  db.data.migration.legacyMigration = true;
  return db.write();
}
