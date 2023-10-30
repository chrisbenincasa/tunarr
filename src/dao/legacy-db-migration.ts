import { promises as fsPromises } from 'fs';
import {
  get,
  isArray,
  isNaN,
  isObject,
  isUndefined,
  map,
  mergeWith,
  parseInt,
  sortBy,
} from 'lodash-es';
import { Low } from 'lowdb';
import path from 'path';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';
import {
  Channel,
  PlexServerSettings,
  PlexStreamSettings,
  Program,
  Resolution,
  Schema,
  Settings,
  defaultPlexStreamSettings,
} from './db.js';

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

async function readAllOldDbFile(file: string): Promise<object[] | object> {
  try {
    const data = await fsPromises.readFile(
      path.resolve(globalOptions().database, file + '.json'),
    );
    const str = data.toString('utf-8');
    const parsed = JSON.parse(str);
    return isArray(parsed) ? (parsed as object[]) : (parsed as object);
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

async function readOldDbFile(file: string): Promise<object> {
  try {
    const data = await readAllOldDbFile(file);
    if (isArray(data)) {
      return data[0] as object;
    } else {
      return data as object;
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
    episodeIcon: program['episodeIcon'] as string | undefined,
    file: program['file'] as string,
    icon: program['icon'] as string,
    key: program['key'] as string,
    plexFile: program['plexFile'] as string,
    ratingKey: program['ratingKey'] as string,
    serverKey: program['serverKey'] as string,
    showTitle: program['showTitle'] as string | undefined,
    summary: program['summary'] as string,
    title: program['title'] as string,
    type: program['type'] as string,
    episode: isMovie ? undefined : (program['episode'] as number | undefined),
    season: isMovie ? undefined : (program['season'] as number | undefined),
    seasonIcon: isMovie
      ? undefined
      : (program['seasonIcon'] as string | undefined),
    // showId: program['showId'] as string,
    showIcon: isMovie ? undefined : (program['showIcon'] as string | undefined),
    date: program['date'] as string,
    rating: program['rating'] as string,
    year: program['year'] as number,
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
    const parsed = JSON.parse(channel.toString('utf-8'));

    const transcodingOptions = get(parsed, 'transcoding.targetResolution');
    const hasTranscodingOptions = !isUndefined(
      emptyStringToUndefined(transcodingOptions),
    );

    return {
      disableFillerOverlay: parsed['disableFillerOverlay'],
      duration: parsed['duration'],
      fallback: parsed['fallback'],
      groupTitle: parsed['groupTitle'],
      guideMinimumDurationSeconds: parsed['guideMinimumDurationSeconds'],
      icon: {
        path: parsed['icon'],
        duration: parsed['iconDuration'],
        position: parsed['iconPosition'],
        width: parsed['iconWidth'],
      },
      startTimeEpoch: new Date(parsed['startTime']).getTime(),
      name: parsed['name'],
      offline: {
        picture: parsed['offlinePicture'],
        soundtrack: emptyStringToUndefined(parsed['offlineSoundtrack']),
        mode: parsed['offlineMode'],
      },
      transcoding:
        hasTranscodingOptions &&
        !isUndefined(tryParseResolution(transcodingOptions))
          ? {
              targetResolution: tryParseResolution(transcodingOptions)!,
            }
          : undefined,
      programs: (parsed['programs'] ?? []).map(convertProgram),
      number: parsed['number'],
      fillerCollections: (parsed['fillerCollections'] ?? []).map((fc) => {
        return {
          id: fc['id'],
          weight: fc['weight'],
          cooldownSeconds: fc['cooldown'] / 1000,
        };
      }),
      watermark: {
        enabled: parsed['watermark']['enabled'],
        duration: parsed['watermark']['duration'],
        position: parsed['watermark']['position'],
        width: parsed['watermark']['width'],
        verticalMargin: parsed['watermark']['verticalMargin'],
        horizontalMargin: parsed['watermark']['horizontalMargin'],
      },
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

export async function migrateFromLegacyDb(db: Low<Schema>) {
  let settings: Partial<Settings> = {};
  try {
    const hdhrSettings = await readOldDbFile('hdhr-settings');
    logger.debug('Migrating HDHR settings', hdhrSettings);
    settings = {
      ...settings,
      hdhr: {
        autoDiscoveryEnabled: hdhrSettings['autoDiscovery'] ?? true,
        tunerCount: hdhrSettings['tunerCount'] ?? 2,
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
        enableImageCache: xmltvSettings['enableImageCache'],
        outputPath: xmltvSettings['file'],
        programmingHours: xmltvSettings['cache'],
        refreshHours: xmltvSettings['refresh'],
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
    let servers: object[] = [];
    if (isArray(plexServers)) {
      servers = [...plexServers];
    } else if (isObject(plexServers)) {
      servers = [plexServers];
    }
    const migratedServers: PlexServerSettings[] = sortBy(
      map(servers, (server) => {
        return {
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
    logger.debug('Migraing channels...');
    await migrateChannels(db);
  } catch (e) {
    logger.error('Unable to migrate channels', e);
  }

  db.data.settings = settings as Required<Settings>;
  db.data.migration.legacyMigration = true;
  return db.write();
}
