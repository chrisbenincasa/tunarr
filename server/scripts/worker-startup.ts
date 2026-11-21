/**
 * Measures what an on-demand worker would cost (#2373).
 *
 * The pool keeps workers alive at boot, and each idle worker holds about
 * 100 MB. Starting workers on the first job would save that memory, but the
 * first schedule save after a quiet period would then wait for a worker to
 * start and pay for a cold first job. This script measures both costs.
 *
 * Each trial boots a server with a pool of one worker and then:
 *
 * 1. Records the boot-time worker start. It competes with the main thread's
 *    own boot, so it overstates a lazy start.
 * 2. Saves one schedule on that idle worker (first job), then several more
 *    (warm jobs).
 * 3. Restarts the worker through the debug route and records its start. This
 *    is the number an on-demand worker would pay, because nothing else runs.
 * 4. Saves one schedule on the restarted worker (first job after boot).
 *
 * Start times come from the pool's "Worker N ready in X ms" log line. Save
 * times are HTTP wall-clock, so main-thread work is included. It is the same
 * in every save, so differences between saves isolate the worker's share.
 *
 * This runs outside vitest because a worker re-executes process.argv[1], which
 * under vitest is vitest's own entry point.
 *
 *   pnpm bench:worker-startup
 *   pnpm bench:worker-startup -- --binary dist/bundle.cjs
 *   pnpm bench:worker-startup -- --binary ../bin/tunarr-<version>-linux-x64
 *   pnpm bench:worker-startup -- --programs 4000 --days 60 --trials 5
 */
import Sqlite from 'better-sqlite3';
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
import { CustomShow } from '../src/db/schema/CustomShow.ts';
import { CustomShowContent } from '../src/db/schema/CustomShowContent.ts';
import { MediaSourceLibrary } from '../src/db/schema/MediaSourceLibrary.ts';
import { Program } from '../src/db/schema/Program.ts';

const { values } = parseArgs({
  // pnpm forwards a literal `--`, after which parseArgs reads every flag as a
  // positional and silently ignores it.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    binary: { type: 'string' },
    programs: { type: 'string', default: '3000' },
    days: { type: 'string', default: '45' },
    'slots-per-day': { type: 'string', default: '48' },
    'warm-saves': { type: 'string', default: '3' },
    trials: { type: 'string', default: '3' },
    port: { type: 'string', default: '18097' },
    'keep-logs': { type: 'boolean', default: false },
  },
});

const PROGRAM_COUNT = Number.parseInt(values.programs, 10);
const MAX_DAYS = Number.parseInt(values.days, 10);
const SLOTS_PER_DAY = Number.parseInt(values['slots-per-day'], 10);
const WARM_SAVES = Number.parseInt(values['warm-saves'], 10);
const TRIALS = Number.parseInt(values.trials, 10);
const PORT = Number.parseInt(values.port, 10);

const BOOT_TIMEOUT_MS = 240_000;
const WORKER_TIMEOUT_MS = 60_000;
const SAVE_TIMEOUT_MS = 600_000;
const HALF_HOUR_MS = 30 * 60 * 1000;

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const READY_LINE = /Worker \d+ ready in (\d+) ms/g;

type TrialResult = {
  bootStartMs: number;
  firstSaveMs: number;
  warmSaveMs: number[];
  restartStartMs: number;
  restartFirstSaveMs: number;
};

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await delay(100);
  }
  return false;
}

function readyTimes(output: string): number[] {
  return [...output.matchAll(READY_LINE)].map((m) =>
    Number.parseInt(m[1] ?? '', 10),
  );
}

type Seed = { programIds: string[]; customShowId: string };

/**
 * Seeds programs, and a custom show holding all of them, into a stopped
 * database. The media source and library rows are required, because
 * MaterializeProgramsCommand silently drops programs without them and the
 * schedule comes back as flex.
 */
function seedPrograms(dbPath: string, count: number): Seed {
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

  const customShowId = randomUUID();
  const content = rows.map((r, index) => ({
    contentUuid: r.uuid,
    customShowUuid: customShowId,
    index,
  }));

  // Chunked to stay under SQLite's bound-variable ceiling.
  const chunkSize = 50;
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
      tx.insert(Program)
        .values(rows.slice(i, i + chunkSize))
        .run();
    }
    tx.insert(CustomShow)
      .values({
        uuid: customShowId,
        name: 'Bench Show',
        createdAt: now,
        updatedAt: now,
      })
      .run();
    for (let i = 0; i < content.length; i += chunkSize * 4) {
      tx.insert(CustomShowContent)
        .values(content.slice(i, i + chunkSize * 4))
        .run();
    }
  });

  sqlite.close();
  return { programIds: rows.map((r) => r.uuid), customShowId };
}

/**
 * `--binary` takes a pkg binary or a bundle (`dist/bundle.cjs`), which runs
 * under the current node. Without it the dev entry runs under tsx, which
 * compiles TypeScript on load and overstates startup.
 */
function serverCommand(serverArgs: string[]): [string, string[]] {
  if (!values.binary) {
    return [
      path.resolve('node_modules/.bin/tsx'),
      ['src/index.ts', ...serverArgs],
    ];
  }
  const target = path.resolve(values.binary);
  return /\.[cm]?js$/.test(target)
    ? [process.execPath, [target, ...serverArgs]]
    : [target, serverArgs];
}

function startServer(
  dataDir: string,
  usePool: boolean,
): { child: ChildProcessWithoutNullStreams; getOutput: () => string } {
  const env = {
    ...process.env,
    NODE_ENV: values.binary ? 'production' : 'development',
    TUNARR_USE_WORKER_POOL: usePool ? 'true' : 'false',
    TUNARR_WORKER_POOL_SIZE: '1',
    TUNARR_LOG_LEVEL: 'info',
    TUNARR_DATABASE_PATH: dataDir,

    // The restart route lives on the debug router, which is dev-only otherwise.
    TUNARR_MOUNT_DEBUG_ENDPOINTS: 'true',
  };
  const serverArgs = [
    'server',
    '--database',
    dataDir,
    '--port',
    String(PORT),
    '--hide_banner',
  ];

  const [command, args] = serverCommand(serverArgs);

  // Own process group, so teardown also stops the meilisearch child.
  const child = spawn(command, args, { env, detached: true });

  let output = '';
  const collect = (c: Buffer) => (output += c.toString().replace(ANSI, ''));
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

async function createChannel(): Promise<string> {
  const configs = JSON.parse((await api('GET', '/transcode_configs')).text) as {
    id?: string;
  }[];
  const transcodeConfigId = configs[0]?.id;
  if (transcodeConfigId === undefined) {
    throw new Error('no transcode config');
  }

  const res = await api('POST', '/channels', {
    type: 'new',
    channel: {
      name: 'Bench worker startup',
      number: 9911,
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
  if (res.status !== 201) {
    throw new Error(
      `channel create failed: ${res.status} ${res.text.slice(0, 300)}`,
    );
  }
  return (JSON.parse(res.text) as { id: string }).id;
}

function makeSchedule(customShowId: string) {
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
      type: 'custom-show' as const,
      customShowId,
      startTime: Math.floor((dayMs / SLOTS_PER_DAY) * i),
      order: 'shuffle' as const,
      direction: 'asc' as const,
      id: randomUUID(),
    })),
  };
}

async function saveSchedule(channelId: string, seed: Seed): Promise<number> {
  const startedAt = performance.now();
  const res = await api(
    'POST',
    `/channels/${channelId}/programming`,
    {
      type: 'time',
      programs: seed.programIds,
      seed: [1, 2, 3, 4],
      schedule: makeSchedule(seed.customShowId),
    },
    SAVE_TIMEOUT_MS,
  );
  const ms = performance.now() - startedAt;
  if (res.status !== 200) {
    throw new Error(
      `schedule save failed: ${res.status} ${res.text.slice(0, 300)}`,
    );
  }

  // No scheduled programs means the seed never reached the schedule, so the
  // worker did no real work and the timing means nothing.
  const { totalPrograms } = JSON.parse(res.text) as { totalPrograms?: number };
  if (!totalPrograms) {
    throw new Error('schedule has no programs');
  }
  return ms;
}

async function runTrial(
  trial: number,
  templateDir: string,
  seed: Seed,
): Promise<TrialResult> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-ws-run-'));
  await fs.rm(dataDir, { recursive: true, force: true });
  await fs.cp(templateDir, dataDir, { recursive: true });

  const { child, getOutput } = startServer(dataDir, true);
  try {
    if (
      !(await waitFor(
        () => /Tunarr is ready/.test(getOutput()),
        BOOT_TIMEOUT_MS,
      ))
    ) {
      throw new Error('server never became ready');
    }
    if (
      !(await waitFor(
        () => readyTimes(getOutput()).length >= 1,
        WORKER_TIMEOUT_MS,
      ))
    ) {
      throw new Error('worker never became ready');
    }
    const bootStartMs = readyTimes(getOutput())[0] ?? 0;

    const channelId = await createChannel();

    // Let boot-time background work drain, so it is not charged to the saves.
    await delay(3_000);

    const firstSaveMs = await saveSchedule(channelId, seed);
    const warmSaveMs: number[] = [];
    for (let i = 0; i < WARM_SAVES; i++) {
      warmSaveMs.push(await saveSchedule(channelId, seed));
    }

    // The worker exits on this request, so the route usually answers with an
    // error. The pool then starts a replacement after its restart backoff.
    await api('GET', '/debug/subprocess/restart').catch(() => undefined);
    if (
      !(await waitFor(
        () => readyTimes(getOutput()).length >= 2,
        WORKER_TIMEOUT_MS,
      ))
    ) {
      throw new Error('restarted worker never became ready');
    }
    const restartStartMs = readyTimes(getOutput())[1] ?? 0;

    await delay(1_000);
    const restartFirstSaveMs = await saveSchedule(channelId, seed);

    console.log(
      `trial ${trial}: start boot ${bootStartMs} ms, after boot ${restartStartMs} ms; ` +
        `saves first ${firstSaveMs.toFixed(0)}, warm ${warmSaveMs.map((ms) => ms.toFixed(0)).join('/')}, ` +
        `after restart ${restartFirstSaveMs.toFixed(0)} ms`,
    );
    return {
      bootStartMs,
      firstSaveMs,
      warmSaveMs,
      restartStartMs,
      restartFirstSaveMs,
    };
  } finally {
    await stopServer(child);
    if (values['keep-logs']) {
      const p = path.join(os.tmpdir(), `tunarr-worker-startup-${trial}.log`);
      await fs.writeFile(p, getOutput());
      console.log(`  log: ${p}`);
    }
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }
}

function median(xs: number[]): number {
  if (xs.length === 0) {
    return 0;
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + hi) / 2 : hi;
}

function report(results: TrialResult[]) {
  const med = (pick: (r: TrialResult) => number) =>
    Math.round(median(results.map(pick)));
  const warm = med((r) => median(r.warmSaveMs));
  const restartStart = med((r) => r.restartStartMs);
  const restartFirst = med((r) => r.restartFirstSaveMs);
  const firstJobPenalty = restartFirst - warm;

  const row = (label: string, ms: number) =>
    console.log(`${label.padEnd(40)} ${`${ms} ms`.padStart(10)}`);

  console.log(`\n${'='.repeat(52)}`);
  console.log('Worker startup');
  console.log(
    `${values.binary ? path.basename(values.binary) : 'src/index.ts via tsx'}; ` +
      `${PROGRAM_COUNT} programs, ${MAX_DAYS} days, ${SLOTS_PER_DAY} slots/day`,
  );
  console.log(`median of ${results.length} trials`);
  console.log('='.repeat(52));
  row(
    'worker start, during boot',
    med((r) => r.bootStartMs),
  );
  row('worker start, after boot', restartStart);
  row(
    'first save, worker started at boot',
    med((r) => r.firstSaveMs),
  );
  row('first save, worker started after boot', restartFirst);
  row('warm save', warm);
  console.log('-'.repeat(52));
  row('first-job penalty (after boot - warm)', firstJobPenalty);
  row('on-demand first save adds', restartStart + firstJobPenalty);
  console.log(
    '\n"On-demand first save adds" is the worker start after boot plus the\n' +
      'first-job penalty: the extra wait on the first save after the pool\n' +
      'has gone idle and let its worker exit.\n',
  );
}

async function main() {
  const templateDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tunarr-ws-tpl-'),
  );
  try {
    // Boot once with the pool off to run migrations, then seed the stopped
    // database.
    console.log('Preparing template database...');
    const { child, getOutput } = startServer(templateDir, false);
    const ready = await waitFor(
      () => /Tunarr is ready/.test(getOutput()),
      BOOT_TIMEOUT_MS,
    );
    await stopServer(child);
    if (!ready) {
      throw new Error('template server never became ready');
    }
    const seed = seedPrograms(path.join(templateDir, 'db.db'), PROGRAM_COUNT);

    const results: TrialResult[] = [];
    for (let trial = 1; trial <= TRIALS; trial++) {
      results.push(await runTrial(trial, templateDir, seed));
    }
    report(results);
  } finally {
    await fs.rm(templateDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();
