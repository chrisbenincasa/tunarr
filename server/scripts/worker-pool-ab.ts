/**
 * A/B benchmark for the Tunarr worker pool.
 *
 * Answers one question: does moving slot scheduling onto a worker thread keep
 * the server responsive while a large schedule is being computed?
 *
 * The metric is deliberately NOT how long the save takes. The pool does not
 * make scheduling faster — it moves it off the main thread, and pays a
 * serialisation cost to do so, so save wall-clock is expected to get slightly
 * *worse*. What should improve is everything else the server is trying to serve
 * at the same time. That is the user-visible symptom behind #1991: saving one
 * channel's schedule stalls in-flight HLS segment requests on every other
 * channel.
 *
 * So both numbers are reported. If the pool doubles save time to halve probe
 * latency, that is a trade worth making knowingly rather than discovering in a
 * bug report.
 *
 * This runs outside vitest because a worker re-executes process.argv[1], which
 * under vitest is vitest's own entry point.
 *
 *   pnpm bench:worker-pool
 *   pnpm bench:worker-pool -- --programs 4000 --days 60 --slots-per-day 48
 */
import Sqlite from 'better-sqlite3';
import http from 'node:http';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
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
    programs: { type: 'string', default: '3000' },
    days: { type: 'string', default: '45' },
    'slots-per-day': { type: 'string', default: '48' },
    'pool-size': { type: 'string', default: '2' },
    'probe-interval': { type: 'string', default: '10' },
    'slow-threshold': { type: 'string', default: '25' },
    port: { type: 'string', default: '18096' },
    trials: { type: 'string', default: '3' },
    'keep-logs': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

const PROGRAM_COUNT = Number.parseInt(values.programs, 10);
const MAX_DAYS = Number.parseInt(values.days, 10);
const SLOTS_PER_DAY = Number.parseInt(values['slots-per-day'], 10);
const POOL_SIZE = Number.parseInt(values['pool-size'], 10);
const PROBE_INTERVAL_MS = Number.parseInt(values['probe-interval'], 10);
const SLOW_THRESHOLD_MS = Number.parseInt(values['slow-threshold'], 10);
const PORT = Number.parseInt(values.port, 10);
const TRIALS = Number.parseInt(values.trials, 10);

const BOOT_TIMEOUT_MS = 240_000;
const SAVE_TIMEOUT_MS = 600_000;
const HALF_HOUR_MS = 30 * 60 * 1000;
/**
 * Probing continues this long after the save returns. The lineup save fires the
 * guide refresh without awaiting it, so the response comes back before the
 * expensive part runs. Closing the window at the response would report the save
 * as cheap and miss the stall that follows.
 */
const SETTLE_MS = 5_000;

type RunResult = {
  label: string;
  saveMs: number;
  probe: ProbeSummary;
  baseline: ProbeSummary;
  workersStarted: number;
  contentCount: number;
};

function log(msg: string) {
  console.log(msg);
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await delay(250);
  }
  return false;
}

/**
 * Seeds programs straight into the database file with the server stopped.
 *
 * Writing while the server runs would work — WAL permits a second writer — but
 * it leaves open the question of whether anything in-process cached an empty
 * program set. Seeding a stopped database and then starting the server removes
 * that doubt entirely, at the cost of one extra boot.
 *
 * The media source and library rows are not optional. MaterializeProgramsCommand
 * silently skips any program with no mediaSourceId, or whose libraryId is not
 * one of that source's libraries. Seeded without them, the schedule comes back
 * as a single flex block and the benchmark measures nothing while appearing to
 * work.
 */
function seedPrograms(dbPath: string, count: number): string[] {
  const sqlite = new Sqlite(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite, casing: 'snake_case', schema });

  const mediaSourceId = randomUUID();
  const sourceName = `bench-source-${mediaSourceId}`;
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

  // Chunked to stay under SQLite's bound-variable ceiling.
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
  usePool: boolean,
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
      // Own process group, so teardown can signal the server *and* the
      // meilisearch process it spawns. Signalling only the server leaves
      // meilisearch running against a temp directory that is about to be
      // deleted, and those orphans accumulate across trials.
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        TUNARR_USE_WORKER_POOL: usePool ? 'true' : 'false',
        TUNARR_WORKER_POOL_SIZE: String(POOL_SIZE),
        // Keep the server's own logging out of the measurement. At debug level
        // pino formatting and stdout writes land on the main thread and show up
        // as probe latency that has nothing to do with scheduling.
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

/** Signals the server's whole process group, so meilisearch goes down with it. */
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
  method: 'GET' | 'POST',
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

/**
 * A keep-alive agent, so connection setup is not charged to probe latency.
 *
 * Without it every probe pays a fresh TCP handshake, which on this path costs
 * more than the stall being measured and buries the signal in noise.
 */
const probeAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });

/**
 * One probe request.
 *
 * `/api/xmltv-last-refresh` is chosen because it is genuinely trivial: a
 * synchronous in-memory lookup with no database access and no subprocess. Any
 * latency it reports is the event loop being unavailable, not the endpoint
 * doing work. `/api/version` looks trivial and is not — it resolves the ffmpeg
 * version, which cost ~45ms per call and swamped the measurement entirely.
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
 * Hits the probe endpoint on a fixed cadence and records how long each call
 * took, measured from when it was *due* rather than when it was sent.
 *
 * Timing from the send would miss the thing being measured: a block that lands
 * between two probes only delays the next send, so the request itself looks
 * fast. A real player asks for its next segment on a schedule and waits however
 * long that takes.
 *
 * Samples are split at `mark()`, so the idle baseline and the loaded period are
 * reported separately. Without that split there is no way to tell a genuine
 * stall from an instrument that is simply slow.
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

async function runConfiguration(
  label: string,
  templateDir: string,
  programIds: string[],
  usePool: boolean,
): Promise<RunResult> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-ab-run-'));
  await fs.rm(dataDir, { recursive: true, force: true });
  await fs.cp(templateDir, dataDir, { recursive: true });

  log(`\n[${label}] starting server (pool=${usePool})`);
  const { child, getOutput } = startServer(dataDir, usePool);

  try {
    const ready = await waitFor(
      () => /Tunarr is ready/.test(getOutput()),
      BOOT_TIMEOUT_MS,
    );
    if (!ready) {
      throw new Error(`[${label}] server never became ready`);
    }

    // Workers come up asynchronously after the server starts serving, so this
    // has to be waited on separately rather than sampled at "ready".
    if (usePool) {
      await waitFor(
        () =>
          (getOutput().match(/Tunarr worker started/g) ?? []).length >=
          POOL_SIZE,
        60_000,
      );
    }
    const workersStarted = (getOutput().match(/Tunarr worker started/g) ?? [])
      .length;
    if (usePool && workersStarted < POOL_SIZE) {
      throw new Error(
        `[${label}] expected ${POOL_SIZE} workers, saw ${workersStarted}. ` +
          `Measuring the pool without workers would compare it against itself.`,
      );
    }
    log(`[${label}] ready, workers started: ${workersStarted}`);

    const configs = JSON.parse(
      (await api('GET', '/transcode_configs')).text,
    ) as { id?: string; uuid?: string }[];
    const transcodeConfigId = configs[0]?.id ?? configs[0]?.uuid;
    if (transcodeConfigId === undefined) {
      throw new Error(`[${label}] no transcode config`);
    }

    const channelRes = await api('POST', '/channels', {
      type: 'new',
      channel: {
        name: `Bench ${label}`,
        number: 9910,
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
        `[${label}] channel create failed: ${channelRes.status} ${channelRes.text.slice(0, 300)}`,
      );
    }
    const channelId = (JSON.parse(channelRes.text) as { id: string }).id;

    // Let boot-time background work drain, so it is not attributed to the save.
    await delay(3_000);

    log(
      `[${label}] saving schedule: ${programIds.length} programs, ${MAX_DAYS} days, ${SLOTS_PER_DAY} slots/day`,
    );
    const probe = startProbe();
    // Baseline: probe the idle server first, so loaded latency has something to
    // be compared against in the same units.
    await delay(2_000);
    probe.mark();

    const startedAt = performance.now();
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
    const saveMs = performance.now() - startedAt;

    await delay(SETTLE_MS);
    const { baseline, loaded } = await probe.stop();

    if (saveRes.status !== 200) {
      throw new Error(
        `[${label}] schedule save failed: ${saveRes.status} ${saveRes.text.slice(0, 300)}`,
      );
    }

    const body = JSON.parse(saveRes.text) as {
      lineup?: { type: string }[];
      totalPrograms?: number;
    };
    const lineup = body.lineup ?? [];
    const contentCount = lineup.filter((i) => i.type === 'content').length;

    // A lineup that is entirely flex means the seeded programs never made it
    // into the schedule — the usual cause is a missing media source or library
    // row, which MaterializeProgramsCommand drops silently. The run would still
    // produce numbers, and they would be measuring nothing.
    if (contentCount === 0) {
      throw new Error(
        `[${label}] lineup contains no content programs (${lineup.length} items, all flex). ` +
          `The seeded programs were not scheduled, so this measurement is meaningless.`,
      );
    }

    log(
      `[${label}] save returned in ${saveMs.toFixed(0)}ms — ${lineup.length} lineup items, ${contentCount} content`,
    );

    return {
      label,
      saveMs,
      probe: loaded,
      baseline,
      workersStarted,
      contentCount,
    };
  } finally {
    await stopServer(child);
    if (values['keep-logs']) {
      const p = path.join(os.tmpdir(), `tunarr-ab-${label}.log`);
      await fs.writeFile(p, getOutput());
      log(`[${label}] log: ${p}`);
    }
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }
}

function row(label: string, a: string, b: string): string {
  return `${label.padEnd(26)} ${a.padStart(14)} ${b.padStart(14)}`;
}

/**
 * Median rather than mean. A single unlucky trial — a background process, a GC
 * pause — moves a mean of three a long way; it barely moves the median.
 */
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

function med(runs: RunResult[], pick: (r: RunResult) => number): number {
  return median(runs.map(pick));
}

function report(offRuns: RunResult[], onRuns: RunResult[]) {
  const pct = (from: number, to: number) =>
    from === 0 ? 'n/a' : `${(((to - from) / from) * 100).toFixed(1)}%`;

  const stat = (pick: (r: RunResult) => number) => ({
    off: med(offRuns, pick),
    on: med(onRuns, pick),
  });

  const saveMs = stat((r) => r.saveMs);
  const baseP50 = stat((r) => r.baseline.p50Ms);
  const baseMax = stat((r) => r.baseline.maxMs);
  const p50 = stat((r) => r.probe.p50Ms);
  const p99 = stat((r) => r.probe.p99Ms);
  const maxMs = stat((r) => r.probe.maxMs);
  const excess = stat((r) => r.probe.totalExcessMs);
  const fails = stat((r) => r.probe.failures);

  console.log(`\n${'='.repeat(58)}`);
  console.log('Worker pool A/B');
  console.log(
    `${PROGRAM_COUNT} programs, ${MAX_DAYS} days, ${SLOTS_PER_DAY} slots/day, pool size ${POOL_SIZE}`,
  );
  console.log(
    `probe every ${PROBE_INTERVAL_MS}ms against /api/xmltv-last-refresh, slow above ${SLOW_THRESHOLD_MS}ms`,
  );
  console.log(`median of ${offRuns.length} trials`);
  console.log('='.repeat(58));
  console.log(row('', 'pool off', 'pool on'));
  console.log('-'.repeat(58));
  console.log(
    row(
      'idle baseline p50',
      `${baseP50.off.toFixed(1)}ms`,
      `${baseP50.on.toFixed(1)}ms`,
    ),
  );
  console.log(
    row(
      'idle baseline max',
      `${baseMax.off.toFixed(1)}ms`,
      `${baseMax.on.toFixed(1)}ms`,
    ),
  );
  console.log(
    row(
      'save wall-clock',
      `${saveMs.off.toFixed(0)}ms`,
      `${saveMs.on.toFixed(0)}ms`,
    ),
  );
  console.log('-'.repeat(58));
  console.log(
    row('probe p50', `${p50.off.toFixed(1)}ms`, `${p50.on.toFixed(1)}ms`),
  );
  console.log(
    row('probe p99', `${p99.off.toFixed(1)}ms`, `${p99.on.toFixed(1)}ms`),
  );
  console.log(
    row('probe max', `${maxMs.off.toFixed(1)}ms`, `${maxMs.on.toFixed(1)}ms`),
  );
  console.log(
    row(
      'total degraded time',
      `${excess.off.toFixed(0)}ms`,
      `${excess.on.toFixed(0)}ms`,
    ),
  );
  console.log(
    row('probe failures', `${fails.off.toFixed(0)}`, `${fails.on.toFixed(0)}`),
  );
  console.log('-'.repeat(58));
  console.log(
    `\nper-trial max stall   off: ${offRuns.map((r) => r.probe.maxMs.toFixed(0)).join(', ')}`,
  );
  console.log(
    `                      on:  ${onRuns.map((r) => r.probe.maxMs.toFixed(0)).join(', ')}`,
  );
  console.log(
    `per-trial save ms     off: ${offRuns.map((r) => r.saveMs.toFixed(0)).join(', ')}`,
  );
  console.log(
    `                      on:  ${onRuns.map((r) => r.saveMs.toFixed(0)).join(', ')}`,
  );
  console.log(
    `\nsave wall-clock         ${pct(saveMs.off, saveMs.on)} with the pool`,
  );
  console.log(
    `worst-case stall        ${pct(maxMs.off, maxMs.on)} with the pool`,
  );
  console.log(
    `total degraded time     ${pct(excess.off, excess.on)} with the pool`,
  );
  console.log(
    `\nNegative is better. The pool is expected to cost save wall-clock and`,
  );
  console.log(`buy back responsiveness; check that the last two moved.\n`);
}

async function main() {
  const templateDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tunarr-ab-tpl-'),
  );

  try {
    // Boot once purely to run migrations, then seed the stopped database.
    log('Preparing template database (migrations)...');
    const { child, getOutput } = startServer(templateDir, false);
    const ready = await waitFor(
      () => /Tunarr is ready/.test(getOutput()),
      BOOT_TIMEOUT_MS,
    );
    await stopServer(child);
    if (!ready) {
      throw new Error('template server never became ready');
    }

    log(`Seeding ${PROGRAM_COUNT} programs...`);
    const programIds = seedPrograms(
      path.join(templateDir, 'db.db'),
      PROGRAM_COUNT,
    );

    const offRuns: RunResult[] = [];
    const onRuns: RunResult[] = [];

    // Configurations alternate within each trial rather than running all of one
    // then all of the other. If the machine gets busier partway through, that
    // drift is shared between the two instead of being attributed to whichever
    // ran second.
    for (let trial = 1; trial <= TRIALS; trial++) {
      log(`\n--- trial ${trial}/${TRIALS} ---`);
      offRuns.push(
        await runConfiguration('pool-off', templateDir, programIds, false),
      );
      onRuns.push(
        await runConfiguration('pool-on', templateDir, programIds, true),
      );
    }

    report(offRuns, onRuns);
  } finally {
    await fs.rm(templateDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();
