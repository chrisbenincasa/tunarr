import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  Lineup,
  LineupItem,
  OnDemandChannelConfig,
} from '@/db/derived_types/Lineup.ts';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.ts';
import { calculateStartTimeOffsets } from '@/db/lineupUtil.ts';
import type { DB } from '@/db/schema/db.ts';
import { GlobalScheduler } from '@/services/Scheduler.ts';
import type { OnDemandChannelService } from '@/services/OnDemandChannelService.ts';
import { calculateStreamDuration } from '@/stream/StreamProgramCalculator.ts';
import { ReconcileProgramDurationsTask } from './ReconcileProgramDurationsTask.ts';

const NOW = 1_760_000_000_000;

type Fixture = {
  items: LineupItem[];
  programs: { uuid: string; duration: number }[];
  startTime?: number;
  onDemandConfig?: OnDemandChannelConfig;
};

function setup({ items, programs, startTime = 0, onDemandConfig }: Fixture) {
  const lineup: Lineup = {
    version: 6,
    lastUpdated: 0,
    items,
    startTimeOffsets: calculateStartTimeOffsets(items),
    onDemandConfig,
  };
  const channel = {
    uuid: 'ch1',
    startTime,
    duration: items.reduce((sum, i) => sum + i.durationMs, 0),
  };

  const channelDB = {
    getAllChannels: vi.fn().mockResolvedValue([channel]),
    loadLineup: vi.fn().mockResolvedValue(lineup),
    loadChannelAndLineup: vi.fn().mockResolvedValue({ channel, lineup }),
    saveLineup: vi.fn().mockResolvedValue(lineup),
    updateChannelStartTime: vi.fn().mockResolvedValue(undefined),
    updateLineupConfig: vi.fn().mockResolvedValue(undefined),
  };

  const db = {
    selectFrom: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(programs),
        }),
      }),
    }),
  } as unknown as Kysely<DB>;

  const onDemandService = {
    runWithChannelLock: vi.fn((_id: string, cb: () => Promise<unknown>) =>
      cb(),
    ),
  } as unknown as OnDemandChannelService;

  const task = new ReconcileProgramDurationsTask(
    channelDB as unknown as IChannelDB,
    db,
    onDemandService,
  );

  return { task, channel, lineup, channelDB, onDemandService };
}

describe('ReconcileProgramDurationsTask', () => {
  let scheduleOneOff: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    scheduleOneOff = vi
      .spyOn(GlobalScheduler, 'scheduleOneOffTask')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('corrects durations and recomputes startTimeOffsets', async () => {
    const { task, channelDB } = setup({
      items: [
        { type: 'content', id: 'p1', durationMs: 1000 },
        { type: 'content', id: 'p2', durationMs: 500 },
      ],
      programs: [
        { uuid: 'p1', duration: 60000 },
        { uuid: 'p2', duration: 30000 },
      ],
    });

    await task.run(undefined);

    expect(channelDB.saveLineup).toHaveBeenCalledTimes(1);
    expect(channelDB.saveLineup).toHaveBeenCalledWith(
      'ch1',
      expect.objectContaining({
        items: [
          { type: 'content', id: 'p1', durationMs: 60000 },
          { type: 'content', id: 'p2', durationMs: 30000 },
        ],
        startTimeOffsets: [0, 60000, 90000],
      }),
    );
    expect(scheduleOneOff).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { channelId: 'ch1' },
    );
  });

  test('rebases the start time so the current program keeps playing', async () => {
    const items: LineupItem[] = [
      { type: 'content', id: 'a', durationMs: 1_800_000 },
      { type: 'content', id: 'b', durationMs: 1_800_000 },
      { type: 'content', id: 'c', durationMs: 1_800_000 },
    ];
    const cycle = 5_400_000;
    // 120 cycles in, 10 minutes into b.
    const startTime = NOW - 120 * cycle - 2_400_000;
    const { task, channel, lineup, channelDB } = setup({
      items,
      startTime,
      programs: [
        { uuid: 'a', duration: 1_741_500 },
        { uuid: 'b', duration: 1_800_000 },
        { uuid: 'c', duration: 1_795_000 },
      ],
    });

    const before = calculateStreamDuration(NOW, startTime, cycle, lineup);
    await task.run(undefined);

    const savedItems = (
      channelDB.saveLineup.mock.calls[0]?.[1] as { items: LineupItem[] }
    ).items;
    const newStart = channelDB.updateChannelStartTime.mock.calls[0]?.[1] as
      | number
      | undefined;
    expect(newStart).toBeDefined();
    if (newStart === undefined) {
      return;
    }
    expect(newStart).toBeLessThanOrEqual(NOW);
    expect(newStart).toBeGreaterThan(channel.startTime - cycle);

    const newCycle = savedItems.reduce((sum, i) => sum + i.durationMs, 0);
    const after = calculateStreamDuration(NOW, newStart, newCycle, {
      ...lineup,
      items: savedItems,
      startTimeOffsets: calculateStartTimeOffsets(savedItems),
    });

    expect(after.currentProgramIndex).toBe(before.currentProgramIndex);
    expect(after.timeElapsed).toBe(before.timeElapsed);
  });

  test('moves an on-demand cursor instead of the start time', async () => {
    const { task, channelDB } = setup({
      items: [
        { type: 'content', id: 'a', durationMs: 1000 },
        { type: 'content', id: 'b', durationMs: 1000 },
      ],
      programs: [
        { uuid: 'a', duration: 700 },
        { uuid: 'b', duration: 1000 },
      ],
      onDemandConfig: {
        state: 'playing',
        cursor: 1000,
        lastResumed: NOW - 200,
      },
    });

    await task.run(undefined);

    expect(channelDB.updateChannelStartTime).not.toHaveBeenCalled();
    // 200 ms into b, which now starts at 700. The resume time is restamped
    // after the save so the next pause keeps the cursor.
    expect(channelDB.updateLineupConfig).toHaveBeenCalledWith(
      'ch1',
      'onDemandConfig',
      { state: 'playing', cursor: 900, lastResumed: NOW },
    );
  });

  test('keeps the resume time of a paused on-demand channel', async () => {
    const { task, channelDB } = setup({
      items: [
        { type: 'content', id: 'a', durationMs: 1000 },
        { type: 'content', id: 'b', durationMs: 1000 },
      ],
      programs: [{ uuid: 'a', duration: 700 }],
      onDemandConfig: {
        state: 'paused',
        cursor: 1500,
        lastResumed: NOW - 50_000,
        lastPaused: NOW - 40_000,
      },
    });

    await task.run(undefined);

    expect(channelDB.updateLineupConfig).toHaveBeenCalledWith(
      'ch1',
      'onDemandConfig',
      {
        state: 'paused',
        cursor: 1200,
        lastResumed: NOW - 50_000,
        lastPaused: NOW - 40_000,
      },
    );
  });

  test('writes nothing when durations already match', async () => {
    const { task, channelDB } = setup({
      items: [{ type: 'content', id: 'a', durationMs: 1000 }],
      programs: [{ uuid: 'a', duration: 1000 }],
    });

    await task.run(undefined);

    expect(channelDB.saveLineup).not.toHaveBeenCalled();
    expect(channelDB.updateChannelStartTime).not.toHaveBeenCalled();
    expect(scheduleOneOff).not.toHaveBeenCalled();
  });

  test('does not touch the start time of a channel that has not started', async () => {
    const { task, channelDB } = setup({
      items: [{ type: 'content', id: 'a', durationMs: 1000 }],
      programs: [{ uuid: 'a', duration: 2000 }],
      startTime: NOW + 60_000,
    });

    await task.run(undefined);

    expect(channelDB.saveLineup).toHaveBeenCalledTimes(1);
    expect(channelDB.updateChannelStartTime).not.toHaveBeenCalled();
  });
});
