import { describe, expect, test, vi } from 'vitest';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceId } from '../../db/schema/base.ts';
import type { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import type { MeilisearchService } from '../../services/MeilisearchService.ts';
import type { SlotCycleBoundaryService } from '../../services/scheduling/SlotCycleBoundaryService.ts';
import { DeleteMediaSourceCommand } from './DeleteMediaSourceCommand.ts';

// The real modules pull in the DI container through an import cycle.
vi.mock('../../db/mediaSourceDB.ts', () => ({ MediaSourceDB: class {} }));
vi.mock('../../services/MeilisearchService.ts', () => ({
  MeilisearchService: class {},
}));
vi.mock('../../services/scheduling/SlotCycleBoundaryService.ts', () => ({
  SlotCycleBoundaryService: class {},
}));

function harness() {
  const order: string[] = [];
  const deletedServer = { uuid: 'source-1' };
  const mediaSourceDB = {
    deleteMediaSource: vi.fn(() => {
      order.push('delete');
      return Promise.resolve({
        programIds: ['p1', 'p2'],
        groupingIds: ['g1'],
        deletedServer,
      });
    }),
  };
  const channelDB = {
    removeProgramsFromAllLineups: vi.fn(() =>
      Promise.resolve(['channel-1', 'channel-2']),
    ),
  };
  const slotCycles = {
    regenerateChannel: vi.fn((channelId: string) => {
      order.push(`rebuild:${channelId}`);
      return Promise.resolve();
    }),
  };
  const command = new DeleteMediaSourceCommand(
    mediaSourceDB as unknown as MediaSourceDB,
    { deleteByIds: vi.fn() } as unknown as MeilisearchService,
    () => ({ deleteCachedClient: vi.fn() }) as unknown as MediaSourceApiFactory,
    channelDB as unknown as IChannelDB,
    slotCycles as unknown as SlotCycleBoundaryService,
  );
  return { command, channelDB, slotCycles, order };
}

describe('DeleteMediaSourceCommand', () => {
  test('rebuilds slot cycles for each channel that lost programs', async () => {
    const { command, channelDB, slotCycles, order } = harness();

    await command.run('source-1' as MediaSourceId);

    expect(channelDB.removeProgramsFromAllLineups).toHaveBeenCalledWith([
      'p1',
      'p2',
    ]);
    // The programs are gone before any rebuild, so it cannot pick them.
    expect(order).toEqual(['delete', 'rebuild:channel-1', 'rebuild:channel-2']);
    expect(slotCycles.regenerateChannel).toHaveBeenCalledTimes(2);
  });

  test('a failed rebuild does not stop the delete or the other channels', async () => {
    const { command, slotCycles } = harness();
    slotCycles.regenerateChannel.mockRejectedValueOnce(new Error('boom'));

    await expect(command.run('source-1' as MediaSourceId)).resolves.toEqual({
      uuid: 'source-1',
    });
    expect(slotCycles.regenerateChannel).toHaveBeenCalledTimes(2);
  });
});
