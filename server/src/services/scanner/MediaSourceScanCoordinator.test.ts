import { Mutex } from 'async-mutex';
import { performance } from 'node:perf_hooks';
import { describe, expect, test, vi } from 'vitest';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { ReconcileProgramDurationsTask } from '../../tasks/ReconcileProgramDurationsTask.ts';
import { workBetween } from '../../util/activeWork.ts';
import type { EntityMutex } from '../EntityMutex.ts';
import type { GenericLocalMediaSourceScannerFactory } from './FileSystemScanner.ts';
import { MediaSourceScanCoordinator } from './MediaSourceScanCoordinator.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { GenericMediaSourceScannerFactory } from './MediaSourceScanner.ts';

vi.mock('../Scheduler.ts', () => ({ GlobalScheduler: { runTask: vi.fn() } }));

describe('MediaSourceScanCoordinator', () => {
  test('records a library scan as active work while it runs', async () => {
    const { promise: scanned, resolve } = withResolvers<string[]>();
    const scanner = {
      scan: vi.fn(() => {
        const now = performance.now();
        resolve(workBetween(now, now));
        return Promise.resolve();
      }),
      cancel: vi.fn(),
    };

    const coordinator = new MediaSourceScanCoordinator(
      {
        getLibrary: vi.fn().mockResolvedValue({
          uuid: 'library-1',
          name: 'Anime Shows',
          mediaType: 'shows',
          unavailableSince: null,
          mediaSource: { type: 'jellyfin' },
        }),
      } as unknown as MediaSourceDB,
      {
        getLockForLibrary: vi.fn().mockResolvedValue(new Mutex()),
      } as unknown as EntityMutex,
      (() => scanner) as unknown as GenericMediaSourceScannerFactory,
      (() => scanner) as unknown as GenericLocalMediaSourceScannerFactory,
      { scanQueued: vi.fn() } as unknown as MediaSourceProgressService,
      () => undefined,
      () => ({}) as ReconcileProgramDurationsTask,
    );

    await expect(
      coordinator.add({ libraryId: 'library-1', forceScan: false }),
    ).resolves.toBe(true);

    expect(await scanned).toContain('Library scan: Anime Shows');
    await coordinator.awaitAllFinished();
  });
});

function withResolvers<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}
