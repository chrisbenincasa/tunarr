import { tag } from '@tunarr/types';
import type { TimeSlotSchedule } from '@tunarr/types/api';
import type { FastifyInstance } from 'fastify';
import { chunk, range } from 'lodash-es';
import { randomUUID } from 'node:crypto';
import { container } from '../../src/container.ts';
import { CustomShowDB } from '../../src/db/CustomShowDB.ts';
import type { ISettingsDB } from '../../src/db/interfaces/ISettingsDB.ts';
import { TranscodeConfigDB } from '../../src/db/TranscodeConfigDB.ts';
import type {
  MediaSourceId,
  MediaSourceName,
} from '../../src/db/schema/base.ts';
import type { DrizzleDBAccess } from '../../src/db/schema/index.ts';
import { MediaSource } from '../../src/db/schema/MediaSource.ts';
import { MediaSourceLibrary } from '../../src/db/schema/MediaSourceLibrary.ts';
import { Program } from '../../src/db/schema/Program.ts';
import { Artwork } from '../../src/db/schema/Artwork.ts';
import { Credit } from '../../src/db/schema/Credit.ts';
import { EntityGenre, Genre } from '../../src/db/schema/Genre.ts';
import { ProgramGrouping } from '../../src/db/schema/ProgramGrouping.ts';
import { Tag, TagRelations } from '../../src/db/schema/Tag.ts';
import { KEYS } from '../../src/types/inject.ts';

// Mirrors SqliteMaxDepthLimit in LineupRepository.ts. The real ceiling is 32766
// bound variables per statement; 1000 is the conservative house number.
const SqliteMaxVariables = 1000;
const ProgramColumnsPerRow = 20;
const ProgramChunkSize = Math.floor(SqliteMaxVariables / ProgramColumnsPerRow);

const HalfHourMs = 30 * 60 * 1000;

function drizzleDb() {
  return container.get<DrizzleDBAccess>(KEYS.DrizzleDB);
}

export type SeedProgramsOptions = {
  durationMs?: number;
  titlePrefix?: string;
};

/**
 * Inserts `count` movie programs, along with the media source and library rows
 * they need.
 *
 * Those two extra rows are not optional. MaterializeProgramsCommand skips any
 * program with no `mediaSourceId`, or whose `libraryId` is not among that
 * media source's libraries — silently, with no error. A lineup built from bare
 * program rows comes back as a single flex block, so a test seeded without them
 * measures an empty schedule while appearing to work.
 */
export async function seedPrograms(
  count: number,
  {
    durationMs = HalfHourMs,
    titlePrefix = 'Seeded Movie',
  }: SeedProgramsOptions = {},
): Promise<string[]> {
  const drizzle = drizzleDb();
  const mediaSourceId = tag<MediaSourceId>(randomUUID());
  const sourceName = tag<MediaSourceName>(`test-source-${mediaSourceId}`);
  const libraryId = randomUUID();
  const now = Date.now();

  drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      accessToken: 'test-token',
      index: 0,
      name: sourceName,
      type: 'plex',
      uri: 'http://localhost:32400',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  drizzle
    .insert(MediaSourceLibrary)
    .values({
      uuid: libraryId,
      name: 'Test Movies',
      mediaType: 'movies',
      mediaSourceId,
      externalKey: '1',
      enabled: true,
    })
    .run();

  const rows = range(count).map((i) => {
    const uuid = randomUUID();
    return {
      uuid,
      createdAt: now,
      updatedAt: now,
      title: `${titlePrefix} ${i}`,
      duration: durationMs,
      type: 'movie' as const,
      sourceType: 'plex' as const,
      // Must be unique and non-empty: two unique indexes cover it, and
      // ApiProgramConverters throws on an empty external id.
      externalKey: `ext-${uuid}`,
      externalSourceId: sourceName,
      mediaSourceId,
      libraryId,
      canonicalId: `plex|${mediaSourceId}|ext-${uuid}`,
      state: 'ok' as const,
      year: 2020,
      summary: 'seeded',
    };
  });

  drizzle.transaction((tx) => {
    for (const rowChunk of chunk(rows, ProgramChunkSize)) {
      tx.insert(Program).values(rowChunk).run();
    }
  });

  return rows.map((row) => row.uuid);
}

export type SeedShowsOptions = {
  showCount: number;
  seasonsPerShow: number;
  episodesPerSeason: number;
  /** Cast rows on each show, each with one artwork row. */
  showCastCount?: number;
  /** Guest, director and writer rows on each episode, each with artwork. */
  episodeCreditCount?: number;
  durationMs?: number;
};

export type SeededShows = {
  showIds: string[];
  episodeIds: string[];
};

/**
 * Inserts TV shows with seasons and episodes, carrying the metadata a real
 * Plex or Jellyfin scan leaves behind: show cast with headshots, genres, tags,
 * and per-episode credits and thumbnails.
 *
 * Bare movies from {@link seedPrograms} have no parents and no credits, so a
 * query that copies each parent's cast into every episode costs nothing
 * against them. Measuring that cost needs this shape.
 */
export async function seedShows({
  showCount,
  seasonsPerShow,
  episodesPerSeason,
  showCastCount = 25,
  episodeCreditCount = 8,
  durationMs = HalfHourMs,
}: SeedShowsOptions): Promise<SeededShows> {
  const drizzle = drizzleDb();
  const mediaSourceId = tag<MediaSourceId>(randomUUID());
  const sourceName = tag<MediaSourceName>(`test-source-${mediaSourceId}`);
  const libraryId = randomUUID();
  const now = Date.now();

  drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      accessToken: 'test-token',
      index: 0,
      name: sourceName,
      type: 'plex',
      uri: 'http://localhost:32400',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  drizzle
    .insert(MediaSourceLibrary)
    .values({
      uuid: libraryId,
      name: 'Test Shows',
      mediaType: 'shows',
      mediaSourceId,
      externalKey: '2',
      enabled: true,
    })
    .run();

  const genreIds = range(6).map(() => randomUUID());
  const tagIds = range(4).map(() => randomUUID());

  const groupings: (typeof ProgramGrouping.$inferInsert)[] = [];
  const episodes: (typeof Program.$inferInsert)[] = [];
  const credits: (typeof Credit.$inferInsert)[] = [];
  const artwork: (typeof Artwork.$inferInsert)[] = [];
  const genreLinks: (typeof EntityGenre.$inferInsert)[] = [];
  const tagLinks: (typeof TagRelations.$inferInsert)[] = [];

  const addCredits = (
    count: number,
    owner: { programId: string } | { groupingId: string },
  ) => {
    for (const i of range(count)) {
      const creditId = randomUUID();
      credits.push({
        uuid: creditId,
        type: 'cast',
        name: `Actor ${creditId.slice(0, 8)}`,
        role: `Role ${i}`,
        index: i,
        ...owner,
      });
      artwork.push({
        uuid: randomUUID(),
        artworkType: 'thumbnail',
        sourcePath: `http://localhost:32400/library/people/${creditId}/thumb`,
        creditId,
      });
    }
  };

  const showIds: string[] = [];
  for (const showIndex of range(showCount)) {
    const showId = randomUUID();
    showIds.push(showId);
    groupings.push({
      uuid: showId,
      type: 'show',
      title: `Seeded Show ${showIndex}`,
      summary: 'seeded',
      plot: 'seeded',
      year: 2020,
      sourceType: 'plex',
      externalKey: `show-${showId}`,
      canonicalId: `plex|${mediaSourceId}|show-${showId}`,
      mediaSourceId,
      libraryId,
      createdAt: now,
      updatedAt: now,
    });
    addCredits(showCastCount, { groupingId: showId });
    for (const artworkType of ['poster', 'fanart', 'logo'] as const) {
      artwork.push({
        uuid: randomUUID(),
        artworkType,
        sourcePath: `http://localhost:32400/library/metadata/${showId}/${artworkType}`,
        groupingId: showId,
      });
    }
    for (const genreId of genreIds.slice(0, 3)) {
      genreLinks.push({ genreId, groupId: showId });
    }
    for (const tagId of tagIds.slice(0, 2)) {
      tagLinks.push({ tagId, groupingId: showId });
    }

    for (const seasonNumber of range(1, seasonsPerShow + 1)) {
      const seasonId = randomUUID();
      groupings.push({
        uuid: seasonId,
        type: 'season',
        title: `Season ${seasonNumber}`,
        index: seasonNumber,
        sourceType: 'plex',
        externalKey: `season-${seasonId}`,
        canonicalId: `plex|${mediaSourceId}|season-${seasonId}`,
        showUuid: showId,
        mediaSourceId,
        libraryId,
        createdAt: now,
        updatedAt: now,
      });
      artwork.push({
        uuid: randomUUID(),
        artworkType: 'poster',
        sourcePath: `http://localhost:32400/library/metadata/${seasonId}/poster`,
        groupingId: seasonId,
      });

      for (const episodeNumber of range(1, episodesPerSeason + 1)) {
        const uuid = randomUUID();
        episodes.push({
          uuid,
          createdAt: now,
          updatedAt: now,
          title: `S${seasonNumber}E${episodeNumber}`,
          duration: durationMs,
          type: 'episode',
          sourceType: 'plex',
          externalKey: `ext-${uuid}`,
          externalSourceId: sourceName,
          mediaSourceId,
          libraryId,
          canonicalId: `plex|${mediaSourceId}|ext-${uuid}`,
          state: 'ok',
          year: 2020,
          summary: 'seeded',
          episode: episodeNumber,
          seasonNumber,
          tvShowUuid: showId,
          seasonUuid: seasonId,
        });
        addCredits(episodeCreditCount, { programId: uuid });
        artwork.push({
          uuid: randomUUID(),
          artworkType: 'thumbnail',
          sourcePath: `http://localhost:32400/library/metadata/${uuid}/thumb`,
          programId: uuid,
        });
        for (const genreId of genreIds.slice(0, 3)) {
          genreLinks.push({ genreId, programId: uuid });
        }
      }
    }
  }

  drizzle.transaction((tx) => {
    tx.insert(Genre)
      .values(genreIds.map((uuid, i) => ({ uuid, name: `Genre ${i}` })))
      .run();
    tx.insert(Tag)
      .values(tagIds.map((uuid, i) => ({ uuid, tag: `seed-tag-${i}-${uuid}` })))
      .run();
    // SQLite caps bound variables per statement; keep every chunk well under.
    const insertChunked = <T>(rows: T[], insert: (chunk: T[]) => void) => {
      for (const rowChunk of chunk(rows, ProgramChunkSize)) {
        insert(rowChunk);
      }
    };
    insertChunked(groupings, (c) => tx.insert(ProgramGrouping).values(c).run());
    insertChunked(episodes, (c) => tx.insert(Program).values(c).run());
    insertChunked(credits, (c) => tx.insert(Credit).values(c).run());
    insertChunked(artwork, (c) => tx.insert(Artwork).values(c).run());
    insertChunked(genreLinks, (c) => tx.insert(EntityGenre).values(c).run());
    insertChunked(tagLinks, (c) => tx.insert(TagRelations).values(c).run());
  });

  return { showIds, episodeIds: episodes.map((e) => e.uuid) };
}

/**
 * Sets the XMLTV programming window.
 *
 * This is the real cost driver for a guide rebuild, and it defaults to just 12
 * hours. Guide work scales with this, not with how many days of lineup were
 * precalculated — which is exactly why users report that lowering "days to
 * precalculate" does not help. A harness left at the default measures a guide
 * rebuild that is too cheap to notice.
 */
export async function setProgrammingHours(hours: number): Promise<void> {
  const settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
  await settingsDB.updateSettings('xmltv', {
    ...settingsDB.xmlTvSettings(),
    programmingHours: hours,
  });
}

export async function defaultTranscodeConfigId(): Promise<string> {
  const config = await container.get(TranscodeConfigDB).getDefaultConfig();
  if (!config) {
    throw new Error('Default transcode config not found after bootstrap');
  }
  return config.uuid;
}

export type CreateChannelOptions = {
  number: number;
  name?: string;
  transcodeConfigId: string;
};

export async function createChannelViaApi(
  app: FastifyInstance,
  { number, name, transcodeConfigId }: CreateChannelOptions,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/channels',
    payload: {
      type: 'new',
      channel: {
        name: name ?? `Perf Channel ${number}`,
        number,
        duration: 0,
        groupTitle: 'perf',
        guideMinimumDuration: 30000,
        icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
        id: '00000000-0000-0000-0000-000000000000',
        startTime: Date.now(),
        stealth: false,
        offline: { mode: 'pic' },
        streamMode: 'hls',
        transcodeConfigId,
        disableFillerOverlay: false,
        subtitlesEnabled: false,
      },
    },
  });

  if (res.statusCode !== 201) {
    throw new Error(
      `Failed to create channel ${number}: ${res.statusCode} ${res.body}`,
    );
  }

  return res.json().id as string;
}

/**
 * Creates a custom show holding the programs in the given order, and returns
 * its id.
 */
export function seedCustomShow(
  programIds: string[],
  durationMs = HalfHourMs,
): Promise<string> {
  return container.get(CustomShowDB).createShow({
    name: 'Seeded Movies',
    programs: programIds.map((id) => ({
      type: 'content',
      id,
      duration: durationMs,
    })),
    syncMediaSourceId: null,
    syncMediaSourceType: null,
    syncExternalPlaylistId: null,
  });
}

export type TimeSlotScheduleOptions = {
  /** Custom show every slot plays, from {@link seedCustomShow}. */
  customShowId: string;
  /** Days of schedule to precalculate. This is the main cost driver. */
  maxDays: number;
  /** Slots per day, spread evenly across 24h. */
  slotsPerDay?: number;
};

export function makeTimeSlotSchedule({
  customShowId,
  maxDays,
  slotsPerDay = 4,
}: TimeSlotScheduleOptions): TimeSlotSchedule {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    type: 'time',
    flexPreference: 'distribute',
    latenessMs: 0,
    maxDays,
    padMs: 1,
    period: 'day',
    timeZoneOffset: new Date().getTimezoneOffset(),
    slots: range(slotsPerDay).map((i) => ({
      type: 'custom-show',
      customShowId,
      startTime: Math.floor((dayMs / slotsPerDay) * i),
      order: 'shuffle',
      direction: 'asc',
      id: randomUUID(),
    })),
  };
}

/** One show slot per show, spread evenly across 24h. */
export function makeShowTimeSlotSchedule({
  maxDays,
  showIds,
}: {
  maxDays: number;
  showIds: string[];
}): TimeSlotSchedule {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    type: 'time',
    flexPreference: 'distribute',
    latenessMs: 0,
    maxDays,
    padMs: 1,
    period: 'day',
    timeZoneOffset: new Date().getTimezoneOffset(),
    slots: showIds.map((showId, i) => ({
      type: 'show',
      showId,
      seasonFilter: [],
      seasonExcludeFilter: [],
      startTime: Math.floor((dayMs / showIds.length) * i),
      order: 'next',
      direction: 'asc',
      id: randomUUID(),
    })),
  };
}

export function saveTimeSlotSchedule(
  app: FastifyInstance,
  channelId: string,
  programIds: string[],
  schedule: TimeSlotSchedule,
) {
  return app.inject({
    method: 'POST',
    url: `/api/channels/${channelId}/programming`,
    payload: {
      type: 'time',
      programs: programIds,
      schedule,
      seed: [1, 2, 3, 4],
    },
  });
}
