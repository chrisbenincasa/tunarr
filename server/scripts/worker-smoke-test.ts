/**
 * Smoke test for Tunarr worker threads.
 *
 * This deliberately does not run under vitest. A worker re-executes
 * `process.argv[1]`, which under vitest is vitest's own entry point, so every
 * spawned worker dies with "Expected worker to be run in node:child_process".
 * That blind spot is why the worker pool rotted unnoticed for a year: nothing
 * in the test suite has ever started a worker. So this drives the real entry
 * point as a child process and asserts on what it writes and serves.
 *
 *   pnpm test:worker-smoke
 *   pnpm test:worker-smoke -- --binary ../bin/tunarr-1.2.0-dev.1-linux-x64
 *
 * Exits non-zero if any check fails.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const WORKER_COUNT = 2;
const SERVER_READY_TIMEOUT_MS = 240_000;
// Once the server is serving, workers have either started or they never will.
// Waiting the full boot timeout again just to report a failure that is already
// decided turns a 30 second red into a four minute one.
const WORKER_GRACE_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

const { values } = parseArgs({
  options: {
    binary: { type: 'string' },
    port: { type: 'string', default: '18094' },
    'keep-logs': { type: 'boolean', default: false },
  },
  // pnpm forwards the `--` separator itself, which parseArgs otherwise treats
  // as an unexpected positional and throws on.
  allowPositionals: true,
});

const port = Number.parseInt(values.port, 10);

// Strips the ANSI colour codes pino-pretty emits. Without this a capture like
// (\S+) swallows the trailing escape sequence and every extracted task name
// comes back decorated with terminal gibberish.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

function plain(s: string): string {
  return s.replace(ANSI, '');
}

// Module scope so the check helpers read the live buffer. Passing it as an
// argument snapshots the string at call time, which silently hides every log
// line the request under test is about to produce.
let output = '';

const failures: string[] = [];
let checkCount = 0;

function check(label: string, ok: boolean, detail?: string) {
  checkCount++;
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    console.error(`  FAIL  ${label}${detail ? `\n          ${detail}` : ''}`);
    failures.push(label);
  }
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(
  description: string,
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await delay(500);
  }
  console.error(`  timed out after ${timeoutMs}ms waiting for ${description}`);
  return false;
}

async function get(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: res.status, body: await res.text() };
}

async function postJson(
  url: string,
  payload: unknown,
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: res.status, body: await res.text() };
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

async function main() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-smoke-'));
  // A directory nothing should ever write to. The worker DB-path regression
  // sent workers to whatever TUNARR_DATABASE_PATH resolved to, because the
  // parent's --database flag was never put on the worker's argv. Pointing that
  // variable at a decoy and asserting it stays empty reproduces that bug
  // directly instead of inferring it from logs.
  const decoyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-decoy-'));

  let child: ChildProcessWithoutNullStreams | undefined;

  try {
    const env = {
      ...process.env,
      TUNARR_USE_WORKER_POOL: 'true',
      TUNARR_WORKER_POOL_SIZE: String(WORKER_COUNT),
      TUNARR_DATABASE_PATH: decoyDir,
      // Not `--log_level`. That flag only sets the bootstrap logger; once
      // SettingsDB loads, LoggerFactory rebuilds the root logger from
      // settings, whose default comes from this variable. The pool logs its
      // dispatch decisions at debug, so without this they never appear.
      TUNARR_LOG_LEVEL: 'debug',
      // The debug router is dev-only unless this is set, and the status probe
      // below lives on it. Without this the binary run 404s where the dev run
      // passes, which is exactly the divergence this harness exists to catch.
      TUNARR_MOUNT_DEBUG_ENDPOINTS: 'true',
      NODE_ENV: values.binary ? 'production' : 'development',
    };

    const serverArgs = [
      'server',
      '--database',
      dataDir,
      '--port',
      String(port),
      '--hide_banner',
    ];

    if (values.binary) {
      const bin = path.resolve(values.binary);
      console.log(`Starting ${bin}`);
      child = spawn(bin, serverArgs, { env, detached: true });
    } else {
      console.log('Starting src/index.ts via tsx');
      child = spawn(
        path.resolve('node_modules/.bin/tsx'),
        ['src/index.ts', ...serverArgs],
        // Own process group so teardown reaches the meilisearch child too.
        { env, detached: true },
      );
    }

    const collect = (chunk: Buffer) => (output += plain(chunk.toString()));
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (err) => console.error('spawn failed:', err));

    console.log(`Waiting for the server and ${WORKER_COUNT} workers...`);
    const serving = await waitFor(
      'the server to start serving',
      () => /Tunarr is ready/.test(output),
      SERVER_READY_TIMEOUT_MS,
    );
    const booted =
      serving &&
      (await waitFor(
        `${WORKER_COUNT} workers to start`,
        () => countMatches(output, /Tunarr worker started/g) >= WORKER_COUNT,
        WORKER_GRACE_MS,
      ));

    console.log('\nChecks:');

    const workersSeen = countMatches(output, /Tunarr worker started/g);
    check(
      `all ${WORKER_COUNT} workers report "started"`,
      workersSeen >= WORKER_COUNT,
      `saw ${workersSeen}`,
    );

    check(
      'the server database lands in the --database directory',
      await exists(path.join(dataDir, 'db.db')),
      `${dataDir}/db.db does not exist`,
    );

    const decoyContents = await fs.readdir(decoyDir);
    check(
      'nothing writes to TUNARR_DATABASE_PATH when --database is passed',
      decoyContents.length === 0,
      `decoy directory contains: ${decoyContents.join(', ')}`,
    );

    // The second regression: workers called runStartupServices(), so
    // migrations, fixers and guide generation ran once per worker.
    const startupTasks = [
      ...output.matchAll(/Running startup task (\S+)/g),
    ].map((m) => m[1]);
    const duplicated = [...new Set(startupTasks)].filter(
      (t) => startupTasks.filter((x) => x === t).length > 1,
    );
    check(
      'startup tasks run once, in the parent only',
      startupTasks.length > 0 && duplicated.length === 0,
      startupTasks.length === 0
        ? 'no startup tasks logged at all — the check may be looking for the wrong string'
        : `run more than once: ${duplicated.join(', ')}`,
    );

    if (booted) {
      await checkRoundTrip();
      await checkTimeSlotDispatch();

      // Asserted only after every dispatch has happened. Checking the log
      // between the two exercises reads a buffer that does not yet contain
      // the lines being asserted on.
      check(
        'a time-slots task is dispatched to a worker',
        /Schedule task type "time-slots" to worker index/.test(output),
        'no time-slots dispatch line in the server log',
      );

      const indices = new Set(
        [...output.matchAll(/to worker index (\d+)/g)].map((m) => m[1]),
      );
      check(
        'work is spread across every worker in the pool',
        indices.size >= WORKER_COUNT,
        `saw dispatches to worker indices: ${[...indices].join(', ') || '(none)'}`,
      );
    } else {
      for (const label of [
        'the pool answers a status request from every worker',
        'a channel can be scheduled through the pool',
        'a time-slots task is dispatched to a worker',
        'work is spread across every worker in the pool',
      ]) {
        check(label, false, 'skipped: server never booted');
      }
    }
  } finally {
    if (child && child.exitCode === null) {
      // SIGTERM first so the server tears down its meilisearch child; SIGKILL
      // only if it will not go quietly.
      signalGroup(child, 'SIGTERM');
      await Promise.race([
        new Promise((r) => child?.once('exit', r)),
        delay(10_000),
      ]);
      if (child.exitCode === null) {
        signalGroup(child, 'SIGKILL');
        await delay(500);
      }
    }
    if (values['keep-logs']) {
      const logPath = path.join(os.tmpdir(), 'tunarr-worker-smoke.log');
      await fs.writeFile(logPath, output);
      console.log(`\nServer log: ${logPath}`);
    }
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(decoyDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`\n${checkCount - failures.length}/${checkCount} checks passed`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join('; ')}`);
    process.exitCode = 1;
  }
}

/**
 * Round-trips one request per worker. The pool dispatches round-robin, so
 * WORKER_COUNT status calls reach every worker in the pool.
 */
async function checkRoundTrip() {
  const base = `http://localhost:${port}/api`;
  const results: string[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    try {
      const res = await get(`${base}/debug/subprocess/status`);
      results.push(res.status === 200 ? res.body : `HTTP ${res.status}`);
    } catch (err) {
      results.push(String(err));
    }
  }

  check(
    'the pool answers a status request from every worker',
    results.length === WORKER_COUNT &&
      results.every((r) => r.includes('healthy')),
    `replies: ${results.join(' | ')}`,
  );
}

/**
 * Drives the production dispatch path, not just the debug one.
 *
 * A time-slot save runs TimeSlotSchedulerService inside the worker, which means
 * the worker's DI container has to resolve real services and open the real
 * database. A worker that boots but cannot serve is caught here and nowhere
 * else.
 */
async function checkTimeSlotDispatch() {
  const base = `http://localhost:${port}/api`;

  try {
    const configsRes = await get(`${base}/transcode_configs`);
    const configs = JSON.parse(configsRes.body) as {
      uuid?: string;
      id?: string;
    }[];
    const transcodeConfigId = configs[0]?.id ?? configs[0]?.uuid;
    if (transcodeConfigId === undefined) {
      check(
        'a channel can be scheduled through the pool',
        false,
        'no transcode config returned',
      );
      return;
    }

    const channelRes = await postJson(`${base}/channels`, {
      type: 'new',
      channel: {
        name: 'Worker Smoke Test',
        number: 9901,
        duration: 0,
        groupTitle: 'smoke',
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
      check(
        'a channel can be scheduled through the pool',
        false,
        `channel create returned ${channelRes.status}: ${channelRes.body.slice(0, 300)}`,
      );
      return;
    }

    const channelId = (JSON.parse(channelRes.body) as { id: string }).id;

    const scheduleRes = await postJson(
      `${base}/channels/${channelId}/programming`,
      {
        type: 'time',
        programs: [],
        seed: [1, 2, 3, 4],
        schedule: {
          type: 'time',
          flexPreference: 'distribute',
          latenessMs: 0,
          maxDays: 2,
          padMs: 1,
          period: 'day',
          timeZoneOffset: new Date().getTimezoneOffset(),
          slots: [
            {
              type: 'movie',
              startTime: 0,
              order: 'shuffle',
              direction: 'asc',
              id: '11111111-1111-4111-8111-111111111111',
            },
          ],
        },
      },
    );

    check(
      'a channel can be scheduled through the pool',
      scheduleRes.status === 200,
      `programming save returned ${scheduleRes.status}: ${scheduleRes.body.slice(0, 300)}`,
    );
  } catch (err) {
    check('a channel can be scheduled through the pool', false, String(err));
  }
}

await main();
