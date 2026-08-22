/**
 * Decomposes the cost of moving a scheduling result across the worker boundary.
 *
 * The pool is only worth promoting if the boundary costs less than the work it
 * moves off the main thread. "Crossing the boundary" is really three separate
 * costs, and they are worth telling apart before optimising the wrong one:
 *
 *   clone      structuredClone of the payload, which postMessage does twice
 *              (once serialising, once deserialising)
 *   transport  the full postMessage round trip, including scheduling latency
 *   validate   the Zod safeParse both sides run on every message
 *
 * Run: pnpm bench:worker-boundary
 */
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { WorkerMessage, WorkerRequest } from '../src/types/worker_schemas.ts';

const SIZES = [500, 2_000, 10_000, 40_000];
const ITERATIONS = 20;

type CondensedItem =
  | { type: 'content'; id: string; duration: number; persisted: boolean }
  | { type: 'flex'; duration: number; persisted: boolean };

/**
 * A lineup shaped like a real time-slot schedule: mostly content, with flex
 * padding between slots.
 */
function makeLineup(count: number): CondensedItem[] {
  const items: CondensedItem[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 7 === 6) {
      items.push({ type: 'flex', duration: 120_000, persisted: false });
    } else {
      items.push({
        type: 'content',
        id: uuid(i),
        duration: 1_800_000,
        persisted: true,
      });
    }
  }
  return items;
}

function hex(i: number, len: number): string {
  return i.toString(16).padStart(len, '0');
}

/** A syntactically valid v4-shaped uuid: 8-4-4-4-12. */
function uuid(i: number): string {
  return `${hex(i, 8)}-0000-4000-8000-${hex(i, 12)}`;
}

function makeReply(count: number) {
  return {
    type: 'success' as const,
    requestId: '11111111-1111-4111-8111-111111111111',
    data: {
      type: 'time-slots' as const,
      result: {
        startTime: Date.now(),
        lineup: makeLineup(count),
        seed: [1, 2, 3, 4],
        discardCount: 0,
      },
    },
  };
}

function makeRequest(programCount: number) {
  return {
    type: 'time-slots' as const,
    requestId: '11111111-1111-4111-8111-111111111111',
    request: {
      type: 'programs' as const,
      programIds: Array.from({ length: programCount }, (_, i) => uuid(i)),
      startTime: Date.now(),
      seed: [1, 2, 3, 4],
      schedule: {
        type: 'time' as const,
        flexPreference: 'distribute' as const,
        latenessMs: 0,
        maxDays: 30,
        padMs: 1,
        period: 'day' as const,
        timeZoneOffset: 0,
        slots: [
          {
            type: 'movie' as const,
            startTime: 0,
            order: 'shuffle' as const,
            direction: 'asc' as const,
            id: '22222222-2222-4222-8222-222222222222',
          },
        ],
      },
    },
  };
}

/**
 * Fails loudly if a fixture does not validate.
 *
 * Zod's failure path costs roughly 20x its success path, because it builds an
 * issue object per bad element. An invalid fixture therefore does not produce a
 * slightly wrong number — it silently turns this into a benchmark of error
 * collection. The first version of this file generated uuids with a 16
 * character final group and overstated request validation by 20x as a result.
 */
function assertValid(label: string, result: { success: boolean }) {
  if (!result.success) {
    throw new Error(
      `${label} fixture does not validate; the benchmark would be timing Zod's error path, not its happy path.`,
    );
  }
}

function timeSync(label: string, iterations: number, fn: () => void): number {
  // One warm-up pass so JIT compilation is not charged to the first sample.
  fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const total = performance.now() - start;
  void label;
  return total / iterations;
}

const ECHO_WORKER = `
  const { parentPort } = require('node:worker_threads');
  parentPort.on('message', (msg) => parentPort.postMessage(msg));
`;

async function measureTransport(
  worker: Worker,
  payload: unknown,
  iterations: number,
): Promise<number> {
  const once = () =>
    new Promise<void>((resolve) => {
      worker.once('message', () => resolve());
      worker.postMessage(payload);
    });

  await once();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await once();
  }
  return (performance.now() - start) / iterations;
}

function fmt(ms: number): string {
  return `${ms.toFixed(2)}ms`.padStart(9);
}

async function main() {
  const worker = new Worker(ECHO_WORKER, { eval: true });
  await new Promise((r) => worker.once('online', r));

  console.log(
    `\nReply path — a scheduling result travelling worker -> main thread`,
  );
  console.log(
    `${'items'.padStart(7)} ${'clone'.padStart(9)} ${'transport'.padStart(9)} ${'validate'.padStart(9)} ${'validate %'.padStart(11)}`,
  );

  for (const size of SIZES) {
    const reply = makeReply(size);

    assertValid('reply', WorkerMessage.safeParse(reply));

    const clone = timeSync('clone', ITERATIONS, () => {
      structuredClone(reply);
    });
    const transport = await measureTransport(worker, reply, ITERATIONS);
    const validate = timeSync('validate', ITERATIONS, () => {
      WorkerMessage.safeParse(reply);
    });

    const share = (validate / (transport + validate)) * 100;
    console.log(
      `${String(size).padStart(7)} ${fmt(clone)} ${fmt(transport)} ${fmt(validate)} ${`${share.toFixed(1)}%`.padStart(11)}`,
    );
  }

  console.log(`\nRequest path — program ids travelling main thread -> worker`);
  console.log(
    `${'ids'.padStart(7)} ${'clone'.padStart(9)} ${'transport'.padStart(9)} ${'validate'.padStart(9)} ${'validate %'.padStart(11)}`,
  );

  for (const size of SIZES) {
    const request = makeRequest(size);

    assertValid('request', WorkerRequest.safeParse(request));

    const clone = timeSync('clone', ITERATIONS, () => {
      structuredClone(request);
    });
    const transport = await measureTransport(worker, request, ITERATIONS);
    const validate = timeSync('validate', ITERATIONS, () => {
      WorkerRequest.safeParse(request);
    });

    const share = (validate / (transport + validate)) * 100;
    console.log(
      `${String(size).padStart(7)} ${fmt(clone)} ${fmt(transport)} ${fmt(validate)} ${`${share.toFixed(1)}%`.padStart(11)}`,
    );
  }

  console.log(
    `\nclone     = structuredClone once. postMessage pays this twice.` +
      `\ntransport = full postMessage round trip through an echo worker.` +
      `\nvalidate  = one Zod safeParse, which the real code runs on receipt.` +
      `\nAveraged over ${ITERATIONS} iterations after a warm-up pass.\n`,
  );

  await worker.terminate();
}

await main();
