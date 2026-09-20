import { tag } from '@tunarr/types';
import type { TimeSlotSchedule } from '@tunarr/types/api';
import type { FastifyInstance } from 'fastify';
import { chunk, range } from 'lodash-es';
import { randomUUID } from 'node:crypto';
import { container } from '../../src/container.ts';
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

export type TimeSlotScheduleOptions = {
  /** Days of schedule to precalculate. This is the main cost driver. */
  maxDays: number;
  /** Slots per day, spread evenly across 24h. */
  slotsPerDay?: number;
};

export function makeTimeSlotSchedule({
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
      type: 'movie',
      startTime: Math.floor((dayMs / slotsPerDay) * i),
      order: 'shuffle',
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
