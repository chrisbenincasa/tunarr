import { describe, expect, test, vi } from 'vitest';
import type { LineupConfig } from '../db/derived_types/Lineup.ts';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import { BuildSlotCycleCommand } from './BuildSlotCycleCommand.ts';

function setup() {
  const queueTask = vi.fn().mockResolvedValue({
    result: {
      lineup: [{ type: 'content', id: 'p1', duration: 500 }],
      discardCount: 12,
      iteratorState: { iterators: {} },
      checkpoints: [],
    },
  });
  const command = new BuildSlotCycleCommand(
    () => ({ queueTask }) as unknown as IWorkerPool,
  );
  return { command, queueTask };
}

function lineupWith(type: 'time' | 'random') {
  return {
    items: [],
    schedule: { type, slots: [] },
    scheduleSeed: [1, 2, 3],
  } as unknown as LineupConfig;
}

describe('BuildSlotCycleCommand', () => {
  test('asks the worker for one checkpointed, stable-shuffle chunk', async () => {
    const { command, queueTask } = setup();
    const iteratorState = { iterators: {} };

    await command.execute({
      channelId: 'ch1',
      lineup: lineupWith('time'),
      startTime: 1_000,
      snapshot: { discardCount: 7, iteratorState },
      chunkMs: 60_000,
    });

    expect(queueTask).toHaveBeenCalledWith({
      type: 'time-slots',
      request: {
        type: 'channel',
        channelId: 'ch1',
        startTime: 1_000,
        seed: [1, 2, 3],
        discardCount: 7,
        iteratorState,
        endTime: 61_000,
        checkpoints: true,
        stableShuffle: true,
        schedule: { type: 'time', slots: [] },
      },
    });
  });

  test('sends random-slot schedules to the random-slot scheduler', async () => {
    const { command, queueTask } = setup();

    await command.execute({
      channelId: 'ch1',
      lineup: lineupWith('random'),
      startTime: 1_000,
      snapshot: undefined,
      chunkMs: 60_000,
    });

    expect(queueTask).toHaveBeenCalledWith({
      type: 'schedule-slots',
      request: expect.objectContaining({
        endTime: 61_000,
        checkpoints: true,
        stableShuffle: true,
        schedule: { type: 'random', slots: [] },
      }),
    });
  });

  test('starts a first cycle from a fresh RNG and no iterator state', async () => {
    const { command, queueTask } = setup();

    const cycle = await command.execute({
      channelId: 'ch1',
      lineup: lineupWith('time'),
      startTime: 1_000,
      snapshot: undefined,
      chunkMs: 60_000,
    });

    expect(queueTask).toHaveBeenCalledWith({
      type: 'time-slots',
      request: expect.objectContaining({
        discardCount: 0,
        iteratorState: undefined,
      }),
    });
    expect(cycle.endSnapshot).toEqual({
      discardCount: 12,
      iteratorState: { iterators: {} },
    });
  });
});
