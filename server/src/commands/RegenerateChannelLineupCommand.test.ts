import { describe, expect, test, vi } from 'vitest';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import type { TVGuideService } from '../services/TvGuideService.ts';
import { RegenerateChannelLineupCommand } from './RegenerateChannelLineupCommand.ts';

vi.mock('../services/TvGuideService.ts', () => ({ TVGuideService: class {} }));

function setup(scheduleSeed?: number[]) {
  const channelDB = {
    loadChannelAndLineupOrm: vi.fn().mockResolvedValue({
      channel: { uuid: 'ch1', startTime: 1000 },
      lineup: {
        items: [],
        schedule: { type: 'time', slots: [] },
        scheduleSeed,
      },
    }),
    replaceChannelPrograms: vi.fn(),
    saveLineup: vi.fn().mockResolvedValue(undefined),
    updateChannelDuration: vi.fn().mockResolvedValue(undefined),
  };
  const queueTask = vi.fn().mockResolvedValue({
    result: {
      lineup: [{ type: 'content', id: 'p1', duration: 500 }],
      seed: [9, 9],
    },
  });
  const tvGuideService = {
    updateCachedChannel: vi.fn().mockResolvedValue(undefined),
  };

  const command = new RegenerateChannelLineupCommand(
    channelDB as unknown as IChannelDB,
    () => ({ queueTask }) as unknown as IWorkerPool,
    tvGuideService as unknown as TVGuideService,
  );
  return { command, channelDB, queueTask };
}

describe('RegenerateChannelLineupCommand', () => {
  test('replays the stored seed', async () => {
    const { command, queueTask } = setup([1, 2, 3]);

    await command.execute({ channelId: 'ch1' });

    expect(queueTask).toHaveBeenCalledWith({
      type: 'time-slots',
      request: expect.objectContaining({ seed: [1, 2, 3], startTime: 1000 }),
    });
  });

  test('stores the seed the scheduler used', async () => {
    const { command, channelDB } = setup();

    await command.execute({ channelId: 'ch1' });

    expect(channelDB.saveLineup).toHaveBeenCalledWith(
      'ch1',
      expect.objectContaining({ scheduleSeed: [9, 9] }),
    );
    expect(channelDB.replaceChannelPrograms).toHaveBeenCalledWith('ch1', [
      'p1',
    ]);
  });
});
