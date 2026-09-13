import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
// container.ts and TunarrWorkerPool.ts import each other. Entering the graph at
// the pool leaves the class in its temporal dead zone when the container tries
// to bind it, so the container has to be the entry point.
import '../container.ts';
import { TunarrWorkerPool } from './TunarrWorkerPool.ts';
import type { TunarrSubprocessService } from './TunarrSubprocessService.ts';

class FakeWorker extends EventEmitter {
  // Replies to every request unless told to hang, which stands in for a worker
  // stuck in a loop it never leaves.
  hang = false;
  postMessage = vi.fn((request: { requestId: string }) => {
    if (this.hang) {
      return;
    }
    setImmediate(() =>
      this.emit('message', {
        type: 'success',
        requestId: request.requestId,
        data: { type: 'status', status: 'healthy' },
      }),
    );
  });
  terminate = vi.fn(() => {
    this.emit('exit', 0);
    return Promise.resolve(0);
  });

  announceReady() {
    this.emit('message', { type: 'event', eventType: 'started' });
  }
}

/**
 * The pool attaches its listeners synchronously after `createWorker` returns,
 * so a worker can only report ready on a later tick.
 */
function makeSubprocessService() {
  const created: FakeWorker[] = [];
  let readyOnSpawn = true;

  const createWorker = vi.fn(() => {
    const worker = new FakeWorker();
    created.push(worker);
    if (readyOnSpawn) {
      setImmediate(() => worker.announceReady());
    }
    return worker;
  });

  return {
    created,
    service: { createWorker } as unknown as TunarrSubprocessService,
    createWorker,
    set spawnHealthy(value: boolean) {
      readyOnSpawn = value;
    },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('TunarrWorkerPool', () => {
  /**
   * `start()` guarded on `#state !== 'pending'` and then assigned
   * `#state = 'pending'` — it rewrote the one value that passes the check as
   * itself, so the "already starting" state was never entered. `#state` only
   * became 'started' inside the `.then()` of the `Promise.all`, an await
   * boundary later, leaving a window in which a second `start()` built a whole
   * second set of workers over the first: the originals were orphaned while
   * `queueTask` round-robined over a half-replaced pool.
   */
  test('a second start() while the first is in flight does not build a second pool', async () => {
    const once = makeSubprocessService();
    const poolOnce = new TunarrWorkerPool(once.service);
    poolOnce.start();
    await poolOnce.allReady();
    const expected = once.createWorker.mock.calls.length;
    expect(expected).toBeGreaterThan(0);

    const twice = makeSubprocessService();
    const poolTwice = new TunarrWorkerPool(twice.service);
    poolTwice.start();
    poolTwice.start();
    await poolTwice.allReady();

    expect(twice.createWorker).toHaveBeenCalledTimes(expected);
  });

  /**
   * `#startPromises` was only ever pushed to, never reset. After a failed
   * startup and a shutdown, a fresh `start()` appended to the same array, so
   * `allReady()` kept awaiting — and re-throwing — the previous run's already
   * terminated workers.
   */
  test('a fresh start() does not await the previous run of workers', async () => {
    const subprocess = makeSubprocessService();
    subprocess.spawnHealthy = false;
    const pool = new TunarrWorkerPool(subprocess.service);

    pool.start();
    await tick();
    subprocess.created.forEach((worker) => worker.emit('exit', 1));
    await expect(pool.allReady()).rejects.toThrow();

    await pool.shutdown(100);

    subprocess.spawnHealthy = true;
    pool.start();

    await expect(pool.allReady()).resolves.toBeUndefined();
  });

  /**
   * A failed startup went to `console.error` rather than the logger, so it was
   * absent from the log files that users actually send in.
   */
  test('a failed startup is reported through the logger, not console', async () => {
    const subprocess = makeSubprocessService();
    subprocess.spawnHealthy = false;
    const pool = new TunarrWorkerPool(subprocess.service);

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pool.start();
    await tick();
    subprocess.created.forEach((worker) => worker.emit('exit', 1));
    await expect(pool.allReady()).rejects.toThrow();
    await tick();

    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
    await pool.shutdown(100);
  });
});

describe('TunarrWorkerPool task timeouts', () => {
  async function startedPool() {
    const subprocess = makeSubprocessService();
    const pool = new TunarrWorkerPool(subprocess.service);
    pool.start();
    await pool.allReady();
    const [first] = subprocess.created;
    if (first === undefined) {
      throw new Error('The pool started no workers');
    }
    return { subprocess, pool, first };
  }

  test('a timed-out task frees its worker for later tasks', async () => {
    const { subprocess, pool, first } = await startedPool();
    const workerCount = subprocess.created.length;
    first.hang = true;

    await expect(pool.queueTask({ type: 'status' }, 50)).rejects.toThrow(
      /timeout/i,
    );

    // One task per slot, so the timed-out worker's slot is used again.
    for (let i = 0; i < workerCount; i++) {
      await expect(pool.queueTask({ type: 'status' }, 1_000)).resolves.toEqual({
        type: 'status',
        status: 'healthy',
      });
    }

    expect(first.terminate).toHaveBeenCalledTimes(1);
    expect(subprocess.createWorker).toHaveBeenCalledTimes(workerCount + 1);
    await pool.shutdown(100);
  }, 15_000);

  test('tasks queued behind a timed-out task are released', async () => {
    const { subprocess, pool, first } = await startedPool();
    const workerCount = subprocess.created.length;
    first.hang = true;

    const timedOut = pool.queueTask({ type: 'status' }, 200);
    const others = Array.from({ length: workerCount - 1 }, () =>
      pool.queueTask({ type: 'status' }, 1_000),
    );
    const queuedBehind = pool.queueTask({ type: 'status' }, 10_000);

    await Promise.all([
      expect(timedOut).rejects.toThrow(/timeout/i),
      expect(queuedBehind).rejects.toThrow(/exited/i),
      expect(Promise.all(others)).resolves.toHaveLength(workerCount - 1),
    ]);
    await pool.shutdown(100);
  }, 5_000);

  test('shutdown after replacing a timed-out worker starts no further workers', async () => {
    const { subprocess, pool, first } = await startedPool();
    first.hang = true;
    await expect(pool.queueTask({ type: 'status' }, 50)).rejects.toThrow(
      /timeout/i,
    );
    await tick();
    await tick();
    const spawned = subprocess.createWorker.mock.calls.length;

    await pool.shutdown(100);
    await tick();

    expect(subprocess.createWorker).toHaveBeenCalledTimes(spawned);
    expect(subprocess.created.at(-1)?.terminate).toHaveBeenCalled();
  });
});
