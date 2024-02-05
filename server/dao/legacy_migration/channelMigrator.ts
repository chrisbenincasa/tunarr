import { Channel, Program } from '@tunarr/types';
import dayjs from 'dayjs';
import { fs } from 'file-system-cache/lib/common/libs.js';
import {
  attempt,
  chain,
  compact,
  difference,
  get,
  isError,
  isUndefined,
  map,
  values,
} from 'lodash-es';
import path from 'path';
import { v4 } from 'uuid';
import createLogger from '../../logger.js';
import { Maybe } from '../../types.js';
import {
  createDirectoryIfNotExists,
  emptyStringToUndefined,
  groupByUniqAndMap,
  isNodeError,
  mapAsyncSeq,
} from '../../util.js';
import { getEm, withDb } from '../dataSource.js';
import {
  ContentItem,
  Lineup,
  LineupItem,
  OfflineItem,
  RedirectItem,
} from '../derived_types/Lineup.js';
import { Channel as ChannelEntity } from '../entities/Channel.js';
import { ChannelFillerShow } from '../entities/ChannelFillerShow.js';
import { CustomShow as CustomShowEntity } from '../entities/CustomShow.js';
import {
  Program as ProgramEntity,
  ProgramSourceType,
  programTypeFromString,
} from '../entities/Program.js';
import {
  JSONArray,
  JSONObject,
  tryParseResolution,
  uniqueProgramId,
} from './migrationUtil.js';
import { convertProgram } from './migrationUtil.js';

const logger = createLogger(import.meta);

export type LegacyProgram = Omit<Program, 'channel'> & {
  isOffline: boolean;
  channel: number;
};

export async function createLineup(
  rawPrograms: LegacyProgram[],
  dbProgramById: Record<string, ProgramEntity>,
): Promise<Lineup> {
  const channels = await getEm()
    .repo(ChannelEntity)
    .findAll({ populate: ['uuid', 'number'] });
  const channelIdsByNumber = groupByUniqAndMap(
    channels,
    'number',
    (c) => c.uuid,
  );

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
          channel: channelIdsByNumber[program.channel],
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

// Migrates programs for a channel. The channel must already be persisted to the DB
export async function migratePrograms(
  fullPath: string,
  channelLineupsPath: string,
) {
  const channelFileContents = await fs.readFile(fullPath);

  const parsed = JSON.parse(
    channelFileContents.toString('utf-8'),
  ) as JSONObject;

  const channelNumber = parsed['number'] as number;

  const em = getEm();

  const channelEntity = await em
    .repo(ChannelEntity)
    .findOneOrFail({ number: channelNumber });

  const fallbackPrograms = ((parsed['fallback'] as Maybe<JSONArray>) ?? []).map(
    convertProgram,
  );

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

  const customShowIds = await em
    .repo(CustomShowEntity)
    .findAll({ populate: ['uuid'] });

  const customShowRefs = chain(programs)
    .flatMap((p) => p.customShowId)
    .compact()
    .uniq()
    .value();

  const missingIds = difference(
    customShowRefs,
    map(customShowIds, (cs) => cs.uuid),
  );
  if (missingIds.length > 0) {
    logger.warn(
      'There are custom show IDs that are not found in the DB: %O',
      missingIds,
    );
  }

  // Associate the programs with the channel
  channelEntity.programs.removeAll();
  channelEntity.customShows.removeAll();

  // Update associations from custom show <-> channel
  channelEntity.customShows.add(
    customShowRefs.map((id) => em.getReference(CustomShowEntity, id)),
  );

  // Update associations from program <-> channel
  channelEntity.programs.set(
    values(dbProgramById).map((id) => em.getReference(ProgramEntity, id.uuid)),
  );

  logger.info('Saving channel');
  await em.persistAndFlush(channelEntity);

  const lineup = await createLineup(programs, dbProgramById);

  logger.info(
    `${lineup.items.length} lineup items for channel ${channelNumber}`,
  );

  const lineupPath = path.join(
    channelLineupsPath,
    `${channelEntity.uuid}.json`,
  );

  const lineupWriteResult = attempt(
    async () => await fs.writeFile(lineupPath, JSON.stringify(lineup)),
  );

  if (isError(lineupWriteResult)) {
    logger.warn(`Unable to write lineups for channel ${channelNumber}`);
  }

  return {
    legacyPrograms: programs,
    legacyFallback: fallbackPrograms,
    persistedPrograms: values(dbProgramById),
    persistedFallbacks: [],
  };
}

export async function migrateChannel(fullPath: string): Promise<{
  raw: Omit<Channel, 'programs' | 'fallback'>;
  entity: ChannelEntity;
}> {
  logger.info('Migrating channel file: ' + fullPath);
  const channelFileContents = await fs.readFile(fullPath);

  const parsed = JSON.parse(
    channelFileContents.toString('utf-8'),
  ) as JSONObject;

  const transcodingOptions = get(
    parsed,
    'transcoding.targetResolution',
  ) as Maybe<string>;
  const hasTranscodingOptions = !isUndefined(
    emptyStringToUndefined(transcodingOptions),
  );

  const watermark = parsed['watermark'] as JSONObject;

  const channel = {
    id: v4(),
    disableFillerOverlay: parsed['disableFillerOverlay'] as boolean,
    duration: parsed['duration'] as number,
    // fallback: ((parsed['fallback'] as Maybe<JSONArray>) ?? []).map(
    // convertProgram,
    // ),
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
      soundtrack: emptyStringToUndefined(parsed['offlineSoundtrack'] as string),
      mode: parsed['offlineMode'] as 'clip' | 'pic',
    },
    transcoding:
      hasTranscodingOptions &&
      !isUndefined(tryParseResolution(transcodingOptions))
        ? {
            targetResolution: tryParseResolution(transcodingOptions)!,
          }
        : undefined,
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
      guideMinimumDurationSeconds: channel.guideMinimumDurationSeconds,
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
      guideMinimumDurationSeconds: channel.guideMinimumDurationSeconds,
    });
  }

  const entity = await em.upsert(ChannelEntity, channelEntity, {
    onConflictFields: ['number'],
    onConflictAction: 'ignore',
  });

  // Init programs, we may have already inserted some
  entity.programs.removeAll();
  entity.customShows.removeAll();

  logger.info('Saving channel');
  await em.persistAndFlush(entity);

  return { raw: channel, entity };
}

export async function migrateChannels(dbPath: string) {
  const channelLineupsPath = path.resolve(dbPath, 'channel-lineups');
  await createDirectoryIfNotExists(channelLineupsPath);

  const channelsBackupPath = path.resolve(dbPath, 'channels-backup');

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

  const channelPath = path.resolve(dbPath, 'channels');

  logger.info(`Using channel directory: ${channelPath}`);

  const channelFiles = await fs.readdir(channelPath);

  logger.info(`Found channels: ${channelFiles.join(', ')}`);

  const migratedChannels = compact(
    await mapAsyncSeq(channelFiles, undefined, async (channel) => {
      try {
        // Create a backup of the channel file
        const fullPath = path.join(channelPath, channel);
        if (!backupExists) {
          logger.info('Creating channel backup...');
          await fs.copyFile(
            fullPath,
            path.join(channelsBackupPath, channel + '.bak'),
          );
        }
        return await migrateChannel(fullPath);
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

  return migratedChannels;
}
export async function persistProgram(program: LegacyProgram) {
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
