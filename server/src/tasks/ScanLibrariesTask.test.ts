import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { MediaSourceScanCoordinator } from '../services/scanner/MediaSourceScanCoordinator.ts';
import { describe, expect, test, vi } from 'vitest';
import { ScanLibrariesTask } from './ScanLibrariesTask.ts';

// The real modules pull in the whole API through a module cycle.
vi.mock('../db/mediaSourceDB.ts', () => ({ MediaSourceDB: class {} }));
vi.mock('../services/scanner/MediaSourceScanCoordinator.ts', () => ({
  MediaSourceScanCoordinator: class {},
}));

const sources = [
  { uuid: 'local-1', type: 'local', libraries: [] },
  {
    uuid: 'plex-1',
    type: 'plex',
    libraries: [
      { uuid: 'plex-lib-1', enabled: true },
      { uuid: 'plex-lib-2', enabled: false },
    ],
  },
];

function makeTask() {
  const coordinator = {
    add: vi.fn().mockResolvedValue(true),
    addLocal: vi.fn().mockResolvedValue(true),
  };
  const task = new ScanLibrariesTask(
    { getAll: vi.fn().mockResolvedValue(sources) } as unknown as MediaSourceDB,
    coordinator as unknown as MediaSourceScanCoordinator,
  );
  return { task, coordinator };
}

describe('ScanLibrariesTask', () => {
  test('queues every source and enabled library without a request', async () => {
    const { task, coordinator } = makeTask();

    await task.run(undefined);

    expect(coordinator.addLocal).toHaveBeenCalledExactlyOnceWith({
      mediaSourceId: 'local-1',
      forceScan: false,
    });
    expect(coordinator.add).toHaveBeenCalledExactlyOnceWith({
      libraryId: 'plex-lib-1',
      forceScan: false,
    });
  });

  test('queues only the requested sources', async () => {
    const { task, coordinator } = makeTask();

    await task.run({ mediaSourceIds: ['plex-1'] });

    expect(coordinator.addLocal).not.toHaveBeenCalled();
    expect(coordinator.add).toHaveBeenCalledExactlyOnceWith({
      libraryId: 'plex-lib-1',
      forceScan: false,
    });
  });
});
