/**
 * A/B harness for changes to the guide refresh path.
 *
 * Runs a real `POST /api/xmltv/refresh` — which is synchronous, so its
 * wall-clock is the build time — while a probe hits a trivial endpoint on a
 * fixed cadence. The probe is the check that a change which makes the build
 * faster does not do it by starving I/O.
 *
 * The two arms are selected by an environment variable read by the code under
 * test, named with `--arm-env` and valued with `--arm-a` / `--arm-b`. The
 * intended workflow is to add a temporary switch on that variable at the call
 * site, run this, then delete the switch and keep the winner. A run with the
 * switch already removed is a useful null control: both arms should agree.
 *
 * Isolation rules: temp directories only, never the real data directory;
 * servers are spawned into their own process group so meilisearch is reaped
 * with them.
 */
import Sqlite from 'better-sqlite3';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema/index.ts';
import { MediaSource } from '../src/db/schema/MediaSource.ts';
import { MediaSourceLibrary } from '../src/db/schema/MediaSourceLibrary.ts';
import { Program } from '../src/db/schema/Program.ts';
import type { ProbeSummary } from '../src/util/probeStats.ts';
import { summarizeProbes } from '../src/util/probeStats.ts';

const { values } = parseArgs({
  options: {
    channels: { type: 'string', default: '12' },
    programs: { type: 'string', default: '1000' },
    days: { type: 'string', default: '7' },
    'slots-per-day': { type: 'string', default: '24' },
    hours: { type: 'string', default: '96' },
    trials: { type: 'string', default: '3' },
    'probe-interval': { type: 'string', default: '50' },
    'slow-threshold': { type: 'string', default: '25' },
    port: { type: 'string', default: '8347' },
    'arm-env': { type: 'string', default: 'TUNARR_GUIDE_YIELD' },
    'arm-a': { type: 'string', default: 'timeout' },
    'arm-b': { type: 'string', default: 'immediate' },
    'keep-logs': { type: 'boolean', default: false },
  },
});

const CHANNEL_COUNT = Number.parseInt(values.channels, 10);
const PROGRAM_COUNT = Number.parseInt(values.programs, 10);
const MAX_DAYS = Number.parseInt(values.days, 10);
const SLOTS_PER_DAY = Number.parseInt(values['slots-per-day'], 10);
const PROGRAMMING_HOURS = Number.parseInt(values.hours, 10);
const TRIALS = Number.parseInt(values.trials, 10);
const PROBE_INTERVAL_MS = Number.parseInt(values['probe-interval'], 10);
const SLOW_THRESHOLD_MS = Number.parseInt(values['slow-threshold'], 10);
const PORT = Number.parseInt(values.port, 10);
const ARM_ENV = values['arm-env'];
const ARM_A = values['arm-a'];
const ARM_B = values['arm-b'];

const BOOT_TIMEOUT_MS = 240_000;
const SAVE_TIMEOUT_MS = 600_000;
const REFRESH_TIMEOUT_MS = 900_000;
const HALF_HOUR_MS = 30 * 60 * 1000;
const SETTLE_MS = 3_000;

type Arm = string;

type RunResult = {
  arm: Arm;
  refreshMs: number;
  probe: ProbeSummary;
  baseline: ProbeSummary;
  guideChannels: number;
};

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 250,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await delay(intervalMs);
  }
  return predicate();
}

function seedPrograms(dbPath: string, count: number): string[] {
  const sqlite = new Sqlite(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite, casing: 'snake_case', schema });

  const mediaSourceId = randomUUID();
  const sourceName = `guide-bench-${mediaSourceId}`;
  const libraryId = randomUUID();
  const now = Date.now();

  db.insert(MediaSource)
    .values({
      uuid: mediaSourceId as never,
      accessToken: 'bench-token',
      index: 0,
      name: sourceName as never,
      type: 'plex',
      uri: 'http://localhost:32400',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(MediaSourceLibrary)
    .values({
      uuid: libraryId,
      name: 'Bench Movies',
      mediaType: 'movies',
      mediaSourceId: mediaSourceId as never,
      externalKey: '1',
      enabled: true,
    })
    .run();

  const rows = Array.from({ length: count }, (_, i) => {
    const uuid = randomUUID();
    return {
      uuid,
      createdAt: now,
      updatedAt: now,
      title: `Bench Movie ${i}`,
      duration: HALF_HOUR_MS,
      type: 'movie' as const,
      sourceType: 'plex' as const,
      externalKey: `ext-${uuid}`,
      externalSourceId: sourceName as never,
      mediaSourceId: mediaSourceId as never,
      libraryId,
      canonicalId: `plex|${mediaSourceId}|ext-${uuid}`,
      state: 'ok' as const,
      year: 2020,
      summary: 'bench',
    };
  });

  const perRow = 20;
  const chunkSize = Math.floor(1000 / perRow);
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
      tx.insert(Program)
        .values(rows.slice(i, i + chunkSize))
        .run();
    }
  });

  sqlite.close();
  return rows.map((r) => r.uuid);
}

function startServer(
  dataDir: string,
  arm: Arm,
): { child: ChildProcessWithoutNullStreams; getOutput: () => string } {
  let output = '';
  const child = spawn(
    path.resolve('node_modules/.bin/tsx'),
    [
      'src/index.ts',
      'server',
      '--database',
      dataDir,
      '--port',
      String(PORT),
      '--hide_banner',
    ],
    {
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        TUNARR_USE_WORKER_POOL: 'false',
        [ARM_ENV]: arm,
        TUNARR_LOG_LEVEL: 'info',
        TUNARR_DATABASE_PATH: dataDir,
      },
    },
  );
  const collect = (c: Buffer) => (output += c.toString());
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  return { child, getOutput: () => output };
}

function signalGroup(
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals,
) {
  try {
    if (child.pid !== undefined) {
      process.kill(-child.pid, signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* nothing left to signal */
    }
  }
}

async function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) {
    return;
  }
  signalGroup(child, 'SIGTERM');
  const exited = await Promise.race([
    new Promise<boolean>((r) => child.once('exit', () => r(true))),
    delay(15_000).then(() => false),
  ]);
  if (!exited) {
    signalGroup(child, 'SIGKILL');
    await delay(500);
  }
}

async function api(
  method: 'GET' | 'POST' | 'PUT',
  route: string,
  body?: unknown,
  timeoutMs = 60_000,
): Promise<{ status: number; text: string }> {
  const res = await fetch(`http://localhost:${PORT}/api${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, text: await res.text() };
}

function makeSchedule() {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    type: 'time' as const,
    flexPreference: 'distribute' as const,
    latenessMs: 0,
    maxDays: MAX_DAYS,
    padMs: 1,
    period: 'day' as const,
    timeZoneOffset: new Date().getTimezoneOffset(),
    slots: Array.from({ length: SLOTS_PER_DAY }, (_, i) => ({
      type: 'movie' as const,
      startTime: Math.floor((dayMs / SLOTS_PER_DAY) * i),
      order: 'shuffle' as const,
      direction: 'asc' as const,
      id: randomUUID(),
    })),
  };
}

const probeAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });

/**
 * `/api/xmltv-last-refresh` is a synchronous in-memory lookup: no database, no
 * subprocess. Latency it reports is the event loop being unavailable.
 */
function probeOnce(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path: '/api/xmltv-last-refresh',
        agent: probeAgent,
        timeout: 30_000,
      },
      (res) => {
        res.resume();
        res.once('end', () =>
          resolve(res.statusCode !== undefined && res.statusCode < 400),
        );
      },
    );
    req.once('error', () => resolve(false));
    req.once('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Latency is measured from when a probe was *due*, not when it was sent. A
 * block that lands between two probes only delays the next send, so timing from
 * the send would report it as fast. A player asks for its next segment on a
 * schedule and waits however long that takes.
 */
function startProbe(): {
  mark: () => void;
  stop: () => Promise<{ baseline: ProbeSummary; loaded: ProbeSummary }>;
} {
  const samples: number[] = [];
  let failures = 0;
  let baselineFailures = 0;
  let splitAt: number | undefined;
  let stopped = false;

  const loop = (async () => {
    let intendedAt = performance.now();
    while (!stopped) {
      const now = performance.now();
      if (now < intendedAt) {
        await delay(intendedAt - now);
      }
      const dueAt = intendedAt;
      const ok = await probeOnce();
      if (!ok) {
        failures++;
      }
      const completedAt = performance.now();
      samples.push(Math.max(0, completedAt - dueAt));
      intendedAt = Math.max(completedAt, dueAt + PROBE_INTERVAL_MS);
    }
  })();

  return {
    mark: () => {
      splitAt = samples.length;
      baselineFailures = failures;
    },
    stop: async () => {
      stopped = true;
      await loop;
      const split = splitAt ?? 0;
      return {
        baseline: summarizeProbes(
          samples.slice(0, split),
          baselineFailures,
          SLOW_THRESHOLD_MS,
        ),
        loaded: summarizeProbes(
          samples.slice(split),
          failures - baselineFailures,
          SLOW_THRESHOLD_MS,
        ),
      };
    },
  };
}

/**
 * How many channels ended up in the built guide, and how many hours the first
 * one spans.
 *
 * `/guide/status` is used rather than `/guide/channels` because it reports the
 * channel ids and time bounds without serializing every program.
 */
async function guideShape(): Promise<{ channels: number; spanHours: number }> {
  const res = await api('GET', '/guide/status');
  if (res.status !== 200) {
    return { channels: -1, spanHours: -1 };
  }
  const body = JSON.parse(res.text) as {
    channelIds?: string[];
    guideTimes?: Record<string, { start: string; end: string }>;
  };
  const channels = body.channelIds?.length ?? -1;
  const first = Object.values(body.guideTimes ?? {})[0];
  const spanHours = first
    ? (Date.parse(first.end) - Date.parse(first.start)) / 3_600_000
    : -1;
  return { channels, spanHours };
}

async function runArm(arm: Arm, templateDir: string): Promise<RunResult> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-guide-run-'));
  await fs.rm(dataDir, { recursive: true, force: true });
  await fs.cp(templateDir, dataDir, { recursive: true });

  log(`[${arm}] starting server`);
  const { child, getOutput } = startServer(dataDir, arm);

  try {
    const ready = await waitFor(
      () => /Tunarr is ready/.test(getOutput()),
      BOOT_TIMEOUT_MS,
    );
    if (!ready) {
      throw new Error(`[${arm}] server never became ready`);
    }

    // A warm-up refresh, untimed. The first build pays JIT, cold caches and
    // whatever boot-time work is still draining; charging that to one arm and
    // not the other would be the whole result.
    await delay(SETTLE_MS);
    log(`[${arm}] warm-up refresh`);
    const warm = await api(
      'POST',
      '/xmltv/refresh',
      undefined,
      REFRESH_TIMEOUT_MS,
    );
    if (warm.status !== 200) {
      throw new Error(`[${arm}] warm-up refresh failed: ${warm.status}`);
    }
    await delay(SETTLE_MS);

    const probe = startProbe();
    // Idle baseline first, so loaded latency has something in the same units
    // to be compared against.
    await delay(2_000);
    probe.mark();

    const startedAt = performance.now();
    const res = await api(
      'POST',
      '/xmltv/refresh',
      undefined,
      REFRESH_TIMEOUT_MS,
    );
    const refreshMs = performance.now() - startedAt;

    await delay(SETTLE_MS);
    const { baseline, loaded } = await probe.stop();

    if (res.status !== 200) {
      throw new Error(
        `[${arm}] refresh failed: ${res.status} ${res.text.slice(0, 300)}`,
      );
    }

    const { channels: guideChannels, spanHours } = await guideShape();
    // A guide with no channels, or one that covers a couple of hours instead of
    // the configured window, builds almost instantly and measures nothing.
    if (guideChannels < CHANNEL_COUNT) {
      throw new Error(
        `[${arm}] guide contains ${guideChannels} channels, expected ${CHANNEL_COUNT}. The build did not do the work being measured.`,
      );
    }
    if (spanHours < PROGRAMMING_HOURS * 0.75) {
      throw new Error(
        `[${arm}] guide spans ${spanHours.toFixed(1)}h, expected ~${PROGRAMMING_HOURS}h.`,
      );
    }

    log(
      `[${arm}] refresh ${refreshMs.toFixed(0)}ms over ${guideChannels} channels, ${spanHours.toFixed(1)}h span`,
    );

    return { arm, refreshMs, probe: loaded, baseline, guideChannels };
  } finally {
    await stopServer(child);
    if (values['keep-logs']) {
      const p = path.join(os.tmpdir(), `tunarr-guide-${arm}.log`);
      await fs.writeFile(p, getOutput());
      log(`[${arm}] log: ${p}`);
    }
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function prepareTemplate(): Promise<string> {
  const templateDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tunarr-guide-tpl-'),
  );

  log('Preparing template database (migrations)...');
  {
    const { child, getOutput } = startServer(templateDir, ARM_A);
    const ready = await waitFor(
      () => /Tunarr is ready/.test(getOutput()),
      BOOT_TIMEOUT_MS,
    );
    await stopServer(child);
    if (!ready) {
      throw new Error('template server never became ready');
    }
  }

  log(`Seeding ${PROGRAM_COUNT} programs...`);
  const programIds = seedPrograms(
    path.join(templateDir, 'db.db'),
    PROGRAM_COUNT,
  );

  log(`Creating ${CHANNEL_COUNT} channels with schedules...`);
  {
    const { child, getOutput } = startServer(templateDir, ARM_A);
    try {
      const ready = await waitFor(
        () => /Tunarr is ready/.test(getOutput()),
        BOOT_TIMEOUT_MS,
      );
      if (!ready) {
        throw new Error('template server never became ready');
      }

      const settingsRes = await api('PUT', '/xmltv-settings', {
        programmingHours: PROGRAMMING_HOURS,
      });
      if (settingsRes.status !== 200) {
        throw new Error(
          `xmltv settings update failed: ${settingsRes.status} ${settingsRes.text.slice(0, 300)}`,
        );
      }

      const configs = JSON.parse(
        (await api('GET', '/transcode_configs')).text,
      ) as { id?: string; uuid?: string }[];
      const transcodeConfigId = configs[0]?.id ?? configs[0]?.uuid;
      if (transcodeConfigId === undefined) {
        throw new Error('no transcode config');
      }

      for (let i = 0; i < CHANNEL_COUNT; i++) {
        const channelRes = await api('POST', '/channels', {
          type: 'new',
          channel: {
            name: `Guide Bench ${i}`,
            number: 9800 + i,
            duration: 0,
            groupTitle: 'bench',
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
        });
        if (channelRes.status !== 201) {
          throw new Error(
            `channel ${i} create failed: ${channelRes.status} ${channelRes.text.slice(0, 300)}`,
          );
        }
        const channelId = (JSON.parse(channelRes.text) as { id: string }).id;

        const saveRes = await api(
          'POST',
          `/channels/${channelId}/programming`,
          {
            type: 'time',
            programs: programIds,
            seed: [1, 2, 3, 4],
            schedule: makeSchedule(),
          },
          SAVE_TIMEOUT_MS,
        );
        if (saveRes.status !== 200) {
          throw new Error(
            `channel ${i} schedule save failed: ${saveRes.status} ${saveRes.text.slice(0, 300)}`,
          );
        }
        const body = JSON.parse(saveRes.text) as {
          lineup?: { type: string }[];
        };
        const content = (body.lineup ?? []).filter(
          (it) => it.type === 'content',
        ).length;
        // An all-flex lineup means the seeded programs were never scheduled.
        // The guide would still build, and would be measuring nothing.
        if (content === 0) {
          throw new Error(
            `channel ${i} lineup has no content programs — seeded programs were not scheduled.`,
          );
        }
        log(`  channel ${i + 1}/${CHANNEL_COUNT}: ${content} content items`);
      }
    } finally {
      await stopServer(child);
    }
  }

  return templateDir;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function row(label: string, a: string, b: string): string {
  return `${label.padEnd(26)} ${a.padStart(14)} ${b.padStart(14)}`;
}

function report(aRuns: RunResult[], bRuns: RunResult[]) {
  const med = (runs: RunResult[], pick: (r: RunResult) => number) =>
    median(runs.map(pick));
  const stat = (pick: (r: RunResult) => number) => ({
    t: med(aRuns, pick),
    i: med(bRuns, pick),
  });
  const pct = (from: number, to: number) =>
    from === 0 ? 'n/a' : `${(((to - from) / from) * 100).toFixed(1)}%`;

  const refresh = stat((r) => r.refreshMs);
  const baseP50 = stat((r) => r.baseline.p50Ms);
  const p50 = stat((r) => r.probe.p50Ms);
  const p99 = stat((r) => r.probe.p99Ms);
  const maxMs = stat((r) => r.probe.maxMs);
  const excess = stat((r) => r.probe.totalExcessMs);
  const fails = stat((r) => r.probe.failures);

  console.log(`\n${'='.repeat(58)}`);
  console.log('Guide refresh A/B (real POST /api/xmltv/refresh)');
  console.log(`arms: ${ARM_ENV}=${ARM_A} vs ${ARM_ENV}=${ARM_B}`);
  console.log(
    `${CHANNEL_COUNT} channels, ${PROGRAM_COUNT} programs, ${MAX_DAYS} days, ` +
      `${SLOTS_PER_DAY} slots/day, ${PROGRAMMING_HOURS}h guide`,
  );
  console.log(
    `probe every ${PROBE_INTERVAL_MS}ms, slow above ${SLOW_THRESHOLD_MS}ms, median of ${aRuns.length} trials`,
  );
  console.log('='.repeat(58));
  console.log(row('', ARM_A, ARM_B));
  console.log('-'.repeat(58));
  console.log(
    row(
      'idle baseline p50',
      `${baseP50.t.toFixed(1)}ms`,
      `${baseP50.i.toFixed(1)}ms`,
    ),
  );
  console.log(
    row(
      'guide build wall-clock',
      `${refresh.t.toFixed(0)}ms`,
      `${refresh.i.toFixed(0)}ms`,
    ),
  );
  console.log('-'.repeat(58));
  console.log(
    row('probe p50', `${p50.t.toFixed(1)}ms`, `${p50.i.toFixed(1)}ms`),
  );
  console.log(
    row('probe p99', `${p99.t.toFixed(1)}ms`, `${p99.i.toFixed(1)}ms`),
  );
  console.log(
    row(
      'worst single stall',
      `${maxMs.t.toFixed(1)}ms`,
      `${maxMs.i.toFixed(1)}ms`,
    ),
  );
  console.log(
    row(
      'total degraded time',
      `${excess.t.toFixed(0)}ms`,
      `${excess.i.toFixed(0)}ms`,
    ),
  );
  console.log(
    row('probe failures', `${fails.t.toFixed(0)}`, `${fails.i.toFixed(0)}`),
  );
  console.log('-'.repeat(58));
  const armLabel = (a: string) =>
    a.padEnd(Math.max(ARM_A.length, ARM_B.length));
  console.log(
    `\nper-trial build ms   ${armLabel(ARM_A)}: ${aRuns.map((r) => r.refreshMs.toFixed(0)).join(', ')}`,
  );
  console.log(
    `                     ${armLabel(ARM_B)}: ${bRuns.map((r) => r.refreshMs.toFixed(0)).join(', ')}`,
  );
  const stalls = (r: RunResult) =>
    r.probe.topSlowMs
      .filter((ms) => ms > SLOW_THRESHOLD_MS)
      .map((ms) => ms.toFixed(0))
      .join(' + ') || '(none)';
  console.log(`\nstalls per trial (slowest samples above the threshold)`);
  aRuns.forEach((r, i) =>
    console.log(`  ${armLabel(ARM_A)} trial ${i + 1}: ${stalls(r)}`),
  );
  bRuns.forEach((r, i) =>
    console.log(`  ${armLabel(ARM_B)} trial ${i + 1}: ${stalls(r)}`),
  );
  console.log(
    `\nguide build wall-clock  ${pct(refresh.t, refresh.i)} with ${ARM_B}  <- headline`,
  );
  console.log(`probe p99               ${pct(p99.t, p99.i)} with ${ARM_B}`);
  console.log(
    `total degraded time     ${pct(excess.t, excess.i)} with ${ARM_B}`,
  );
  console.log(
    `\nNegative is better. The probe columns are the check on whether a faster`,
  );
  console.log(`build was bought by starving I/O.\n`);
}

async function main() {
  const templateDir = await prepareTemplate();
  try {
    const aRuns: RunResult[] = [];
    const bRuns: RunResult[] = [];

    // Arms alternate within a trial. If the machine gets busier partway
    // through, the drift is shared rather than charged to whichever ran second.
    for (let trial = 1; trial <= TRIALS; trial++) {
      log(`\n--- trial ${trial}/${TRIALS} ---`);
      aRuns.push(await runArm(ARM_A, templateDir));
      bRuns.push(await runArm(ARM_B, templateDir));
    }

    report(aRuns, bRuns);
  } finally {
    await fs.rm(templateDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();
