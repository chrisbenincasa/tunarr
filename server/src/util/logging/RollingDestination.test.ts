import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RollingLogDestination,
  SIZE_CHECK_INTERVAL_MS,
} from './RollingDestination.ts';

describe('RollingLogDestination', () => {
  let dir: string;
  let fileName: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tunarr-roll-'));
    fileName = path.join(dir, 'tunarr.log');
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function workerDestination() {
    return pino.destination({ dest: fileName, append: true, sync: true });
  }

  // Workers log through a plain append destination on the file the main
  // thread rolls (#2193). This pins down that their handles stay valid.
  it('keeps a second append-mode writer on the live file across a roll', async () => {
    const roller = new RollingLogDestination({
      fileName,
      destinationOpts: { append: true, sync: true },
    });
    const main = roller.initDestination();
    await once(main, 'ready');

    const worker = workerDestination();

    main.write('main before\n');
    worker.write('worker before\n');

    roller.roll();

    worker.write('worker after\n');
    main.write('main after\n');

    // Writing at a stale offset after the truncate would leave a run of NUL
    // bytes at the start of the file.
    expect(fs.readFileSync(fileName, 'utf8')).toBe(
      'worker after\nmain after\n',
    );
    expect(fs.readFileSync(`${fileName}.1`, 'utf8')).toBe(
      'main before\nworker before\n',
    );

    worker.end();
    roller.deinitialize();
  });

  describe('size-based rolling', () => {
    async function setup(maxSizeBytes: number) {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const roller = new RollingLogDestination({
        fileName,
        maxSizeBytes,
        destinationOpts: { append: true, sync: true },
      });
      const main = roller.initDestination();
      await once(main, 'ready');
      return roller;
    }

    // The main thread may be idle while workers log, so the size check must
    // see bytes written through other handles.
    it('rolls when another writer pushes the file past the limit', async () => {
      const roller = await setup(64);
      const worker = workerDestination();
      const line = 'x'.repeat(79) + '\n';

      worker.write(line);
      vi.advanceTimersByTime(SIZE_CHECK_INTERVAL_MS);

      expect(fs.readFileSync(fileName, 'utf8')).toBe('');
      expect(fs.readFileSync(`${fileName}.1`, 'utf8')).toBe(line);

      worker.end();
      roller.deinitialize();
    });

    it('does not roll while the file is under the limit', async () => {
      const roller = await setup(1024);
      const worker = workerDestination();

      worker.write('small\n');
      vi.advanceTimersByTime(SIZE_CHECK_INTERVAL_MS);

      expect(fs.readFileSync(fileName, 'utf8')).toBe('small\n');
      expect(fs.existsSync(`${fileName}.1`)).toBe(false);

      worker.end();
      roller.deinitialize();
    });

    it('stops checking after deinitialize', async () => {
      const roller = await setup(64);
      roller.deinitialize();
      const worker = workerDestination();

      worker.write('x'.repeat(100) + '\n');
      vi.advanceTimersByTime(SIZE_CHECK_INTERVAL_MS);

      expect(fs.existsSync(`${fileName}.1`)).toBe(false);

      worker.end();
    });
  });
});
