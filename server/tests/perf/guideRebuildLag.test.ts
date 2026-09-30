import type { FastifyInstance } from 'fastify';
import { range, sortBy, sum } from 'lodash-es';
import { writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../../src/container.ts';
import type { IChannelDB } from '../../src/db/interfaces/IChannelDB.ts';
import type { IProgramDB } from '../../src/db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from '../../src/db/interfaces/ISettingsDB.ts';
import type { ProgramWithRelationsOrm } from '../../src/db/schema/derivedTypes.ts';
import { GlobalScheduler } from '../../src/services/Scheduler.ts';
import { XmlTvWriter } from '../../src/services/XmlTvWriter.ts';
import { UpdateXmlTvTask } from '../../src/tasks/UpdateXmlTvTask.ts';
import { KEYS } from '../../src/types/inject.ts';
import { formatLagSummary } from '../../src/util/eventLoopLag.ts';
import { getAvailablePort } from '../../src/util/net.ts';
import {
  formatProbeSummary,
  measureWithConcurrentProbe,
} from '../support/probe.ts';
import {
  createChannelViaApi,
  defaultTranscodeConfigId,
  makeShowTimeSlotSchedule,
  saveTimeSlotSchedule,
  seedShows,
  setProgrammingHours,
} from '../support/seed.ts';
import { initTestApp } from '../testServer.js';

/**
 * Measures request stalls during the hourly all-channel guide rebuild, and the
 * cost of the program loads behind it and behind each stream start.
 *
 * The guide rebuild materializes every program in the EPG window through
 * `getProgramsByIds`. That query's relation set decides how much it pulls, so
 * the seed uses TV shows with cast, genres and artwork. Bare movies would hide
 * the cost of copying each show's cast into every episode.
 *
 * Scale is env-overridable:
 *
 *   TUNARR_PERF_CHANNELS=40 TUNARR_PERF_SHOWS=80 TUNARR_PERF_EPG_HOURS=336 \
 *     pnpm vitest run tests/perf/guideRebuildLag.test.ts --silent=false
 *
 * Longest concurrent-request stall during one hourly rebuild, at the defaults
 * (20 channels, 1200 episodes, 168h EPG):
 *
 *   full relation set, one-shot XMLTV write       827-863ms
 *   guide relation set                            560-675ms
 *   shows loaded once, yielding load and write     16-34ms
 *
 * At 40 channels, 2400 episodes and 336h EPG the last row measures 27-31ms.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const CHANNEL_COUNT = envInt('TUNARR_PERF_CHANNELS', 20);
const SHOW_COUNT = envInt('TUNARR_PERF_SHOWS', 40);
const SEASONS_PER_SHOW = envInt('TUNARR_PERF_SEASONS', 3);
const EPISODES_PER_SEASON = envInt('TUNARR_PERF_EPISODES', 10);
const SHOWS_PER_CHANNEL = envInt('TUNARR_PERF_SHOWS_PER_CHANNEL', 4);
const SCHEDULE_DAYS = envInt('TUNARR_PERF_DAYS', 14);
const PROGRAMMING_HOURS = envInt('TUNARR_PERF_EPG_HOURS', 168);
const STREAM_LOOKUPS = envInt('TUNARR_PERF_STREAM_LOOKUPS', 200);
const SETTLE_MS = envInt('TUNARR_PERF_SETTLE_MS', 8_000);

const PROBE_URL = '/api/xmltv-last-refresh';

// Set to a file path to write a .cpuprofile of the rebuild. It covers the
// operation and a settle window, and opens in Chrome DevTools.
const CPU_PROFILE_PATH = process.env['TUNARR_PERF_CPU_PROFILE'];

async function withCpuProfile<T>(
  path: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (path === undefined) {
    return operation();
  }

  const session = new Session();
  session.connect();
  const post = (method: string, params?: object) =>
    new Promise<unknown>((resolve, reject) =>
      session.post(method, params, (err, result) =>
        err ? reject(err) : resolve(result),
      ),
    );

  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: 500 });
  await post('Profiler.start');
  try {
    const result = await operation();
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    return result;
  } finally {
    const { profile } = (await post('Profiler.stop')) as { profile: object };
    await writeFile(path, JSON.stringify(profile));
    session.disconnect();
  }
}

let app: FastifyInstance;
let channelIds: string[];
let episodeIds: string[];

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort(), {
    registerGuideTask: true,
  });

  await setProgrammingHours(PROGRAMMING_HOURS);

  const transcodeConfigId = await defaultTranscodeConfigId();
  const seeded = await seedShows({
    showCount: SHOW_COUNT,
    seasonsPerShow: SEASONS_PER_SHOW,
    episodesPerSeason: EPISODES_PER_SEASON,
  });
  episodeIds = seeded.episodeIds;

  channelIds = [];
  for (const i of range(CHANNEL_COUNT)) {
    const channelId = await createChannelViaApi(app, {
      number: 900 + i,
      transcodeConfigId,
    });
    channelIds.push(channelId);

    // Overlapping windows of shows, so the guide spans every seeded episode.
    const showIds = range(SHOWS_PER_CHANNEL).map(
      (j) => seeded.showIds[(i * 2 + j) % seeded.showIds.length] ?? '',
    );
    const res = await saveTimeSlotSchedule(
      app,
      channelId,
      seeded.episodeIds,
      makeShowTimeSlotSchedule({ maxDays: SCHEDULE_DAYS, showIds }),
    );
    expect(res.statusCode).toBe(200);
  }

  // Every create and save above queues a guide refresh behind the guide lock,
  // each rewriting the whole XMLTV file. A foreground run queues last, so it
  // returns once that backlog has drained and cannot leak into a measurement.
  await GlobalScheduler.runScheduledJobNow(UpdateXmlTvTask.ID, false);
}, 600_000);

afterAll(async () => {
  await app?.close();
});

describe('guide rebuild', () => {
  test('produces a lineup of episodes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelIds[0]}/programming`,
    });

    expect(res.statusCode).toBe(200);
    const lineup = res.json().lineup as { type: string }[];
    const contentItems = lineup.filter((item) => item.type === 'content');
    console.log(
      '[perf] seeded lineup: %d items, %d content',
      lineup.length,
      contentItems.length,
    );
    expect(contentItems.length).toBeGreaterThan(0);
  }, 60_000);

  test('bulk program load used by the guide', async () => {
    const programDB = container.get<IProgramDB>(KEYS.ProgramDB);

    // getProgramsByIds is the full API load, kept as a reference point.
    const loaders = {
      getGuideProgramsByIds: () =>
        programDB.getGuideProgramsByIds(episodeIds, {
          includeCreditArtwork: false,
        }),
      'getGuideProgramsByIds+creditArtwork': () =>
        programDB.getGuideProgramsByIds(episodeIds, {
          includeCreditArtwork: true,
        }),
      getProgramsByIds: () => programDB.getProgramsByIds(episodeIds),
    };

    for (const [name, load] of Object.entries(loaders)) {
      const start = performance.now();
      const programs = await load();
      const elapsedMs = performance.now() - start;
      const bytes = Buffer.byteLength(JSON.stringify(programs));

      console.log(
        '[perf] %s(%d): %sms, %s MB',
        name,
        programs.length,
        elapsedMs.toFixed(0),
        (bytes / 1024 / 1024).toFixed(1),
      );
      expect(programs.length).toBe(episodeIds.length);
    }
  }, 120_000);

  test('single program load used by each stream start', async () => {
    const programDB = container.get<IProgramDB>(KEYS.ProgramDB);

    // getProgramById is the full detail load, kept as a reference point.
    for (const method of ['getStreamProgramById', 'getProgramById'] as const) {
      const timings: number[] = [];
      let bytes = 0;
      for (const i of range(STREAM_LOOKUPS)) {
        const id = episodeIds[i % episodeIds.length];
        if (id === undefined) {
          throw new Error('No seeded episodes');
        }
        const start = performance.now();
        const program = await programDB[method](id);
        timings.push(performance.now() - start);
        bytes += Buffer.byteLength(JSON.stringify(program));
      }

      console.log(
        '[perf] %s x%d: mean=%sms max=%sms, %s KB/program',
        method,
        STREAM_LOOKUPS,
        (sum(timings) / timings.length).toFixed(2),
        Math.max(...timings).toFixed(2),
        (bytes / STREAM_LOOKUPS / 1024).toFixed(1),
      );
    }
  }, 120_000);

  test('guide relation set writes the same XMLTV as the full set', async () => {
    const programDB = container.get<IProgramDB>(KEYS.ProgramDB);
    const settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
    const writer = container.get(XmlTvWriter);
    const channel = await container
      .get<IChannelDB>(KEYS.ChannelDB)
      .getChannelOrm(channelIds[0] ?? '');
    if (!channel) {
      throw new Error('Seeded channel not found');
    }

    const programmes = (programs: ProgramWithRelationsOrm[]) =>
      writer.generateXmltv([
        {
          channel,
          programs: programs.map((program, i) => ({
            start: i * program.duration,
            stop: (i + 1) * program.duration,
            durationMs: program.duration,
            title: program.title,
            programming: { type: 'program', program },
          })),
        },
      ]).programmes;

    // uuid order, so both loads line up program for program.
    const byUuid = (programs: ProgramWithRelationsOrm[]) =>
      sortBy(programs, (p) => p.uuid);
    const full = byUuid(await programDB.getProgramsByIds(episodeIds));

    for (const includeCreditArtwork of [false, true]) {
      await settingsDB.updateSettings('featureFlags', {
        ...settingsDB.featureFlags(),
        xmltvCreditImagesEnabled: includeCreditArtwork,
      });
      const guide = byUuid(
        await programDB.getGuideProgramsByIds(episodeIds, {
          includeCreditArtwork,
        }),
      );
      expect(programmes(guide)).toEqual(programmes(full));
    }

    await settingsDB.updateSettings('featureFlags', {
      ...settingsDB.featureFlags(),
      xmltvCreditImagesEnabled: false,
    });
  }, 120_000);

  test('hourly all-channel rebuild does not stall concurrent requests', async () => {
    const { probe, lag } = await measureWithConcurrentProbe({
      app,
      url: PROBE_URL,
      // The task fires the subtitle sweep after the guide is written.
      settleMs: SETTLE_MS,
      operation: () =>
        withCpuProfile(CPU_PROFILE_PATH, () =>
          GlobalScheduler.runScheduledJobNow(UpdateXmlTvTask.ID, false),
        ),
    });

    expect(probe.failures).toBe(0);

    console.log(
      '[perf] hourly rebuild (%d channels, %d episodes, %dh EPG)\n' +
        '       probe: %s\n' +
        '       loop:  %s',
      CHANNEL_COUNT,
      episodeIds.length,
      PROGRAMMING_HOURS,
      formatProbeSummary(probe),
      formatLagSummary(lag),
    );
  }, 600_000);
});
