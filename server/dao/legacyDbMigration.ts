import dayjs from 'dayjs';
import {
  Channel,
  FfmpegSettings,
  PlexServerSettings,
  Program,
  defaultFfmpegSettings,
  defaultPlexStreamSettings,
} from 'dizquetv-types';
import fs from 'fs/promises';
import {
  chain,
  compact,
  get,
  isArray,
  isError,
  isNaN,
  isNumber,
  isObject,
  isUndefined,
  map,
  merge,
  mergeWith,
  parseInt,
  sortBy,
  values,
} from 'lodash-es';
import { Low } from 'lowdb';
import path from 'path';
import { v4 } from 'uuid';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import {
  attempt,
  createDirectoryIfNotExists,
  groupByUniq,
  isNodeError,
  mapAsyncSeq,
} from '../util.js';
import { EntityManager, getEm, initOrm, withDb } from './dataSource.js';
import {
  CustomShow,
  PlexStreamSettings,
  ProgramType,
  Resolution,
  Schema,
  SettingsSchema,
  defaultHdhrSettings,
  defaultSchema,
  defaultXmlTvSettings,
} from './settings.js';
import {
  ContentItem,
  Lineup,
  LineupItem,
  OfflineItem,
  RedirectItem,
} from './derived_types/Lineup.js';
import { CachedImage } from './entities/CachedImage.js';
import { Channel as ChannelEntity } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { CustomShow as CustomShowEntity } from './entities/CustomShow.js';
import { FillerShow } from './entities/FillerShow.js';
import { PlexServerSettings as PlexServerSettingsEntity } from './entities/PlexServerSettings.js';
import {
  Program as ProgramEntity,
  ProgramSourceType,
  programTypeFromString,
} from './entities/Program.js';

const logger = createLogger(import.meta);

async function readAllOldDbFile(file: string): Promise<JSONArray | JSONObject> {
  const data = await fs.readFile(
    path.resolve(globalOptions().database, file + '.json'),
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

function uniqueProgramId(program: Program): string {
  return `${program.serverKey!}|${program.key!}`;
}

interface JSONArray extends Array<JSONValue> {}

type JSONValue = string | number | undefined | boolean | JSONObject | JSONArray;

interface JSONObject extends Record<string, JSONValue> {}

async function persistProgram(program: Program) {
  return withDb(
    async (em) => {
      if (['movie', 'episode', 'track'].includes(program.type ?? '')) {
        const dbProgram = new ProgramEntity();
        dbProgram.durationObj = dayjs.duration({
          milliseconds: program.duration,
        });
        dbProgram.sourceType = ProgramSourceType.PLEX;
        dbProgram.episode = program.episode;
        dbProgram.filePath = program.file;
        dbProgram.icon = program.icon;
        dbProgram.externalKey = program.key!;
        dbProgram.plexRatingKey = program.ratingKey!;
        dbProgram.plexFilePath = program.plexFile;
        dbProgram.externalSourceId = program.serverKey!;
        dbProgram.showTitle = program.showTitle;
        dbProgram.summary = program.summary;
        dbProgram.title = program.title!;
        // This is checked above
        dbProgram.type = programTypeFromString(program.type)!;
        dbProgram.episode = program.episode;
        dbProgram.season = program.season;
        dbProgram.seasonIcon = program.seasonIcon;
        dbProgram.showIcon = program.showIcon;
        dbProgram.originalAirDate = program.date;
        dbProgram.rating = program.rating;
        dbProgram.year = program.year;

        return em.upsert(ProgramEntity, dbProgram, {
          onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
          onConflictAction: 'merge',
          onConflictExcludeFields: ['uuid'],
        });
      }

      return;
    },
    undefined,
    true,
  );
}

function convertProgram(program: JSONObject): Program {
  const programType = program['type'] as string | undefined;
  const isMovie = programType === 'movie';
  const outProgram: Program = {
    id: v4(),
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

  return outProgram;
}

function createLineup(
  rawPrograms: Program[],
  dbProgramById: Record<string, ProgramEntity>,
): Lineup {
  const lineupItems: LineupItem[] = chain(rawPrograms)
    .map((program) => {
      if (
        program.type &&
        ['movie', 'episode', 'track'].includes(program.type)
      ) {
        // Content type
        return {
          type: 'content',
          id: dbProgramById[uniqueProgramId(program)].uuid,
          durationMs: program.duration,
        } as ContentItem;
      } else if (program.type === 'redirect') {
        return {
          type: 'redirect',
          channel: program.channel!,
          durationMs: program.duration,
        } as RedirectItem;
      } else if (program.isOffline) {
        return {
          type: 'offline',
          durationMs: program.duration,
        } as OfflineItem;
      }

      return;
    })
    .compact()
    .value();

  return {
    items: lineupItems,
  };
}

async function migrateChannels() {
  const channelLineupsPath = path.resolve(
    globalOptions().database,
    'channel-lineups',
  );
  await createDirectoryIfNotExists(channelLineupsPath);

  const channelsBackupPath = path.resolve(
    globalOptions().database,
    'channels-backup',
  );

  let backupExists = false;

  try {
    await fs.mkdir(channelsBackupPath);
  } catch (e) {
    if (isNodeError(e) && e.code !== 'EEXIST') {
      logger.error('Error', e);
      return;
    } else {
      backupExists = (await fs.readdir(channelsBackupPath)).length > 0;
    }
  }

  const channelPath = path.resolve(globalOptions().database, 'channels');

  async function migrateChannel(
    file: string,
  ): Promise<{ raw: Channel; entity: ChannelEntity }> {
    logger.info('Migrating channel: ' + file);
    const channelFileContents = await fs.readFile(path.join(channelPath, file));

    // Create a backup of the channel file
    if (!backupExists) {
      logger.info('Creating channel backup...');
      await fs.copyFile(
        path.join(channelPath, file),
        path.join(channelsBackupPath, file + '.bak'),
      );
    }

    const parsed = JSON.parse(
      channelFileContents.toString('utf-8'),
    ) as JSONObject;

    const channelNumber = parsed['number'] as number;

    const transcodingOptions = get(
      parsed,
      'transcoding.targetResolution',
    ) as Maybe<string>;
    const hasTranscodingOptions = !isUndefined(
      emptyStringToUndefined(transcodingOptions),
    );

    const watermark = parsed['watermark'] as JSONObject;

    const programs = ((parsed['programs'] as JSONArray) ?? []).map(
      convertProgram,
    );

    const dbProgramById = (
      await mapAsyncSeq(programs, undefined, (p) =>
        persistProgram(p).then((dbProgram) => {
          if (dbProgram) {
            return {
              [uniqueProgramId(p)]: dbProgram,
            };
          } else {
            return {};
          }
        }),
      )
    ).reduce((v, prev) => ({ ...v, ...prev }), {});

    const lineup = createLineup(programs, dbProgramById);

    logger.info(
      `${lineup.items.length} lineup items for channel ${channelNumber}`,
    );

    const lineupPath = path.join(channelLineupsPath, `${channelNumber}.json`);

    const lineupWriteResult = attempt(
      async () => await fs.writeFile(lineupPath, JSON.stringify(lineup)),
    );
    if (isError(lineupWriteResult)) {
      logger.warn(`Unable to write lineups for channel ${channelNumber}`);
    }

    const channel = {
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
      startTime: dayjs(parsed['startTime'] as string).unix() * 1000,
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
      programs,
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

    const em = getEm();

    let channelEntity: ChannelEntity;
    const existingEntity = await em.findOne(
      ChannelEntity,
      {
        number: channel.number,
      },
      { populate: ['programs', 'customShows'] },
    );

    if (existingEntity) {
      channelEntity = existingEntity;
      em.assign(channelEntity, {
        disableFillerOverlay: channel.disableFillerOverlay,
        groupTitle: channel.groupTitle,
        icon: channel.icon,
        name: channel.name,
        number: channel.number,
        startTime: channel.startTime,
        stealth: channel.stealth,
        transcoding: channel.transcoding,
        watermark: channel.watermark,
        offline: { mode: 'clip' },
      });
    } else {
      channelEntity = em.create(ChannelEntity, {
        duration: channel.duration,
        disableFillerOverlay: channel.disableFillerOverlay,
        groupTitle: channel.groupTitle,
        icon: channel.icon,
        name: channel.name,
        number: channel.number,
        startTime: channel.startTime,
        stealth: channel.stealth,
        transcoding: channel.transcoding,
        watermark: channel.watermark,
        offline: { mode: 'clip' },
      });
    }

    channelEntity.guideMinimumDuration = dayjs.duration({
      seconds: channel.guideMinimumDurationSeconds,
    });

    const entity = await em.upsert(ChannelEntity, channelEntity, {
      onConflictFields: ['number'],
      onConflictAction: 'ignore',
    });

    // Init programs, we may have already inserted some
    entity.programs.removeAll();
    entity.customShows.removeAll();

    entity.programs.set(
      values(dbProgramById).map((id) =>
        em.getReference(ProgramEntity, id.uuid),
      ),
    );

    const customShowRefs = chain(channel.programs)
      .flatMap((p) => p.customShowId)
      .compact()
      .uniq()
      .value();

    entity.customShows.add(
      customShowRefs.map((id) => em.getReference(CustomShowEntity, id)),
    );

    console.log('Saving channel');
    await em.persistAndFlush(entity);

    return { raw: channel, entity };
  }

  logger.info(`Using channel directory: ${channelPath}`);

  const channelFiles = await fs.readdir(channelPath);

  logger.info(`Found channels: ${channelFiles.join(', ')}`);

  const migratedChannels = compact(
    await mapAsyncSeq(channelFiles, undefined, async (channel) => {
      try {
        return await migrateChannel(channel);
      } catch (e) {
        logger.error(`Unable to migrate channel ${channel}`, e);
        return;
      }
    }),
  );

  // Create filler associations
  const em = getEm();
  await mapAsyncSeq(
    migratedChannels,
    undefined,
    async ({ raw: channel, entity }) => {
      const fillers = channel.fillerCollections ?? [];
      const relations = map(fillers, (filler) => {
        const cfs = em.create(ChannelFillerShow, {
          channel: entity.uuid,
          fillerShow: filler.id,
          weight: filler.weight,
        });
        cfs.cooldown = dayjs.duration({ seconds: filler.cooldownSeconds });
        return cfs;
      });

      await em.upsertMany(ChannelFillerShow, relations, {
        onConflictAction: 'ignore',
      });

      return em.flush();
    },
  );

  // // Create custom show associations
  // await sequentialPromises(
  //   migratedChannels,
  //   undefined,
  //   async ({ raw: channel, entity }) => {
  //     const customShowRefs = chain(channel.programs)
  //       .flatMap((p) => p.customShowId)
  //       .compact()
  //       .uniq()
  //       .value();

  //     entity.customShows.removeAll();
  //     entity.customShows.add(
  //       customShowRefs.map((id) => em.getReference(CustomShowEntity, id)),
  //     );
  //     return em.persist(entity).flush();
  //   },
  // );

  return migratedChannels;
}

async function migrateCustomShows(type: 'custom-shows' | 'filler') {
  const prettyType = type === 'custom-shows' ? 'custom show' : 'filler';
  const customShowsPath = path.join(globalOptions().database, type);
  const configFiles = await fs.readdir(customShowsPath);

  const newCustomShows = await configFiles.reduce(
    async (prev, file) => {
      const id = file.replace('.json', '');
      logger.info(`Migrating ${prettyType}: ${file}`);
      const channel = await fs.readFile(path.join(customShowsPath, file));
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

  await withDb(async (em) => {
    const uniquePrograms = chain(newCustomShows)
      .flatMap((cs) => cs.content)
      .uniqBy(uniqueProgramId)
      .value();

    const persistedPrograms = (
      await mapAsyncSeq(uniquePrograms, undefined, (program) =>
        persistProgram(program).then((dbProgram) =>
          dbProgram
            ? {
                [uniqueProgramId(program)]: dbProgram,
              }
            : {},
        ),
      )
    ).reduce((value, prev) => ({ ...value, ...prev }), {});

    const entityType = type === 'custom-shows' ? CustomShowEntity : FillerShow;
    const repo = em.getRepository(entityType);

    const customShowById = groupByUniq(newCustomShows, 'id');

    await mapAsyncSeq(newCustomShows, undefined, async (customShow) => {
      // Refresh the entity after inserting programs
      const existing = await repo.findOne(
        { uuid: customShow.id },
        { populate: ['content'], refresh: true },
      );

      // If we didn't find one, initialize it
      const entity =
        existing ??
        em.create(entityType, {
          uuid: customShow.id,
          name: customShow.name,
        });

      // Reset mappings
      const content = customShowById[entity.uuid].content;
      entity.content.removeAll();
      entity.content.set(
        content.map((c) => persistedPrograms[uniqueProgramId(c)]),
      );
      em.persist(entity);
    });

    await em.flush();
  });
}

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
  db.data = { ...defaultSchema };
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
        logger.info('Migrating HDHR settings', hdhrSettings);
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
            ...defaultXmlTvSettings,
          },
        };
      } else {
        logger.info('Migrating XMLTV settings', xmltvSettings);
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
        logger.info('Migrating Plex settings', plexSettings);
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
              maxAudioChannels: parseIntOrDefault(
                plexSettings['maxAudioChannels'],
                defaultPlexStreamSettings.maxAudioChannels,
              ),
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
              streamPath: plexSettings['streamPath'] as Maybe<string>,
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
        logger.info('Migrating ffmpeg settings', ffmpegSettings);
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
    logger.info('Migrating client ID');
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
      logger.info('Migrating custom shows');
      await migrateCustomShows('custom-shows');
    } catch (e) {
      logger.error('Unable to migrate all custom shows', e);
    }
  }

  if (entitiesToMigrate.includes('filler-shows')) {
    try {
      logger.info('Migrating filler shows');
      await migrateCustomShows('filler');
    } catch (e) {
      logger.error('Unable to migrate all filler shows', e);
    }
  }

  if (entitiesToMigrate.includes('channels')) {
    try {
      logger.info('Migraing channels...');
      await migrateChannels();
    } catch (e) {
      logger.error('Unable to migrate channels', e);
    }
  }

  if (entitiesToMigrate.includes('cached-images')) {
    try {
      logger.info('Migrating cached images');
      await migrateCachedImages();
    } catch (e) {
      logger.error('Unable to migrate cached images', e);
    }
  }

  // Close the ORM
  await initOrm().then((s) => s.close());

  db.data.settings = settings as Required<SettingsSchema>;
  db.data.migration.legacyMigration = true;
  return db.write();
}
