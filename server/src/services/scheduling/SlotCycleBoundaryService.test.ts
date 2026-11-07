import type { Channel } from '@/db/schema/Channel.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { sumBy } from 'lodash-es';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { BuildSlotCycleCommand } from '../../commands/BuildSlotCycleCommand.ts';
import type { Lineup, LineupItem } from '../../db/derived_types/Lineup.ts';
import { CurrentLineupSchemaVersion } from '../../db/derived_types/Lineup.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import type {
  IChannelDB,
  UpdateChannelLineupRequest,
} from '../../db/interfaces/IChannelDB.ts';
import { createChannel } from '../../testing/fakes/entityCreators.ts';
import { fixtureRandomSlotSchedule } from '../../testing/fakes/slotScheduleFixtures.ts';
import { ChannelLineupLock } from '../ChannelLineupLock.ts';
import type { TVGuideService } from '../TvGuideService.ts';
import type { BuiltCycle } from './slotCycles.ts';
import { SlotCycleBoundaryService } from './SlotCycleBoundaryService.ts';

// The real guide service pulls in most of the server. The boundary service
// only ever calls updateCachedChannel.
vi.mock('../TvGuideService.ts', () => ({ TVGuideService: class {} }));
vi.mock('@/services/TvGuideService.js', () => ({ TVGuideService: class {} }));

const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;

// Off every minute boundary, so a rounded startTime write fails the exactness
// assertions below.
const cycleMs = 61 * oneMinute + 7_123;
const itemDurations = [40 * oneMinute, cycleMs - 40 * oneMinute];
const programmingHours = 4;
const horizonMs = programmingHours * oneHour;

const channelId = '00000000-0000-4000-8000-00000000c0de';

function tick(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function totalDurationMs(items: readonly LineupItem[]) {
  return sumBy(items, (item) => item.durationMs);
}

type FakeChannelDB = {
  db: IChannelDB;
  state: { channel: Channel; lineup: Lineup };
  saves: UpdateChannelLineupRequest[];
  startTimeWrites: number[];
  channelProgramIds: Set<string>;
};

// Stores one channel and its lineup. Reads hand out copies and both reads and
// writes yield, so an unlocked read-modify-write loses an update here.
function createFakeChannelDB(lineup: Lineup): FakeChannelDB {
  const state = {
    channel: createChannel({ uuid: channelId, startTime: 0, duration: 0 }),
    lineup,
  };
  const saves: UpdateChannelLineupRequest[] = [];
  const startTimeWrites: number[] = [];
  const channelProgramIds = new Set<string>();

  const db = {
    loadChannelAndLineup: async (id: string) => {
      await tick(1);
      if (id !== state.channel.uuid) {
        return null;
      }
      return {
        channel: { ...state.channel },
        lineup: { ...state.lineup, items: [...state.lineup.items] },
      };
    },
    saveLineup: async (id: string, req: UpdateChannelLineupRequest) => {
      await tick(1);
      expect(id).toBe(state.channel.uuid);
      saves.push(req);

      const merged: Record<string, unknown> = {
        ...state.lineup,
        lastUpdated: Date.now(),
      };
      for (const [key, value] of Object.entries(req)) {
        if (value === null) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      }
      state.lineup = merged as unknown as Lineup;

      if (req.items !== undefined) {
        state.channel.duration = totalDurationMs(state.lineup.items);
      }
      return state.lineup;
    },
    addChannelPrograms: (id: string, programIds: string[]) => {
      expect(id).toBe(state.channel.uuid);
      for (const programId of programIds) {
        channelProgramIds.add(programId);
      }
    },
    updateChannelStartTime: async (id: string, newTime: number) => {
      await tick(1);
      expect(id).toBe(state.channel.uuid);
      startTimeWrites.push(newTime);
      state.channel.startTime = newTime;
    },
    getAllChannels: async () => {
      await tick(1);
      return [state.channel];
    },
  };

  return {
    db: db as unknown as IChannelDB,
    state,
    saves,
    startTimeWrites,
    channelProgramIds,
  };
}

type FakeBuilder = {
  command: BuildSlotCycleCommand;
  calls: { startTime: number; discardCount: number }[];
};

// Each cycle's items name the start time they were built for, so a lineup
// stitched together from stale reads is detectable.
function createFakeBuildCommand(): FakeBuilder {
  const calls: FakeBuilder['calls'] = [];
  const delays = [3, 0, 5, 1, 4, 2];

  const execute = async (req: {
    startTime: number;
    snapshot?: { discardCount: number };
  }): Promise<BuiltCycle> => {
    const index = calls.length;
    calls.push({
      startTime: req.startTime,
      discardCount: req.snapshot?.discardCount ?? 0,
    });

    await tick(delays[index % delays.length] ?? 0);

    const items: LineupItem[] = itemDurations.map((durationMs, i) => ({
      type: 'content',
      id: `b${index}@${req.startTime}#${i}`,
      durationMs,
    }));

    return {
      items,
      durationMs: cycleMs,
      endSnapshot: {
        discardCount: (req.snapshot?.discardCount ?? 0) + items.length,
        iteratorState: {
          iterators: {
            main: { type: 'ordered', lastProgramId: `@${req.startTime}` },
          },
        },
      },
    };
  };

  return {
    command: { execute } as unknown as BuildSlotCycleCommand,
    calls,
  };
}

function builtAt(item: LineupItem) {
  if (item.type !== 'content') {
    throw new Error('expected a content item');
  }
  const start = item.id.split('@')[1]?.split('#')[0];
  return Number(start);
}

function baseLineup(overrides: Partial<Lineup> = {}): Lineup {
  return {
    version: CurrentLineupSchemaVersion,
    lastUpdated: 0,
    items: [],
    startTimeOffsets: [0],
    schedule: fixtureRandomSlotSchedule({ maxDays: 1 }),
    scheduleSeed: [1, 2, 3],
    rebuildEachCycle: true,
    ...overrides,
  };
}

function setup(lineup: Lineup = baseLineup()) {
  const channelDB = createFakeChannelDB(lineup);
  const builder = createFakeBuildCommand();
  const settingsDB = {
    xmlTvSettings: () => ({ programmingHours }),
  } as unknown as ISettingsDB;
  const tvGuideService = {
    updateCachedChannel: vi.fn().mockResolvedValue(undefined),
  };
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  } as unknown as Logger;

  const service = new SlotCycleBoundaryService(
    channelDB.db,
    settingsDB,
    new ChannelLineupLock(),
    builder.command,
    tvGuideService as unknown as TVGuideService,
    logger,
  );

  return { service, channelDB, builder, tvGuideService };
}

// Every invariant the stored state has to satisfy, whatever order the
// concurrent calls finished in.
function expectConsistentState(channelDB: FakeChannelDB, now: number) {
  const { channel, lineup } = channelDB.state;
  const cycles = lineup.cycles ?? [];

  expect(cycles.length).toBeGreaterThan(0);
  expect(sumBy(cycles, (cycle) => cycle.itemCount)).toBe(lineup.items.length);
  expect(sumBy(cycles, (cycle) => cycle.durationMs)).toBe(channel.duration);
  expect(totalDurationMs(lineup.items)).toBe(channel.duration);

  // Cycles are contiguous: each one's items were built for the time its
  // predecessors end at, and no two cycles claim the same start.
  const starts: number[] = [];
  let cycleStart = channel.startTime;
  let index = 0;
  for (const cycle of cycles) {
    const items = lineup.items.slice(index, index + cycle.itemCount);
    expect(totalDurationMs(items)).toBe(cycle.durationMs);
    for (const item of items) {
      expect(builtAt(item)).toBe(cycleStart);
    }
    starts.push(cycleStart);
    cycleStart += cycle.durationMs;
    index += cycle.itemCount;
  }
  expect(new Set(starts).size).toBe(starts.length);

  // The channel is playable now and covered past the horizon.
  expect(channel.startTime).toBeLessThanOrEqual(now);
  expect(cycleStart).toBeGreaterThan(now + horizonMs);
  expect(lineup.nextCycleSnapshot).toBeDefined();
}

describe('SlotCycleBoundaryService', () => {
  const now0 = +new Date('2024-03-06T13:47:19.531Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initializes an empty lineup and writes the exact start time', async () => {
    const { service, channelDB, tvGuideService } = setup();

    await service.advanceChannel(channelId, now0);

    const expectedStart = now0 - (now0 % oneMinute);
    expect(channelDB.startTimeWrites).toEqual([expectedStart]);
    expect(channelDB.state.channel.startTime).toBe(expectedStart);
    expect(channelDB.saves.length).toBeGreaterThan(0);
    expect(tvGuideService.updateCachedChannel).toHaveBeenCalledWith(
      channelId,
      true,
    );
    expectConsistentState(channelDB, now0);
  });

  test('does nothing when rebuildEachCycle is off', async () => {
    const { service, channelDB, builder, tvGuideService } = setup(
      baseLineup({ rebuildEachCycle: false }),
    );

    await service.advanceChannel(channelId, now0);
    await service.regenerateChannel(channelId, now0);

    expect(builder.calls).toHaveLength(0);
    expect(channelDB.saves).toHaveLength(0);
    expect(channelDB.startTimeWrites).toHaveLength(0);
    expect(tvGuideService.updateCachedChannel).not.toHaveBeenCalled();
  });

  test('does nothing when the lineup has no slot schedule', async () => {
    const { service, channelDB, builder } = setup(
      baseLineup({ schedule: undefined }),
    );

    await service.advanceChannel(channelId, now0);

    expect(builder.calls).toHaveLength(0);
    expect(channelDB.saves).toHaveLength(0);
  });

  test('writes nothing when the horizon is already covered', async () => {
    const { service, channelDB, tvGuideService } = setup();

    await service.advanceChannel(channelId, now0);
    const savesAfterInit = channelDB.saves.length;
    const startTimeWritesAfterInit = channelDB.startTimeWrites.length;
    tvGuideService.updateCachedChannel.mockClear();

    await service.advanceChannel(channelId, now0 + oneMinute);

    expect(channelDB.saves).toHaveLength(savesAfterInit);
    expect(channelDB.startTimeWrites).toHaveLength(startTimeWritesAfterInit);
    expect(tvGuideService.updateCachedChannel).not.toHaveBeenCalled();
  });

  test('trims by whole cycles and writes the start time exactly', async () => {
    const { service, channelDB } = setup();

    await service.advanceChannel(channelId, now0);
    const initialStart = channelDB.state.channel.startTime;

    const now = initialStart + 2 * cycleMs + 11;
    await service.advanceChannel(channelId, now);

    const expectedStart = initialStart + 2 * cycleMs;
    expect(channelDB.state.channel.startTime).toBe(expectedStart);
    expect(channelDB.startTimeWrites.at(-1)).toBe(expectedStart);
    expectConsistentState(channelDB, now);
  });

  const interleavings: { name: string; ops: ('advance' | 'regenerate')[] }[] = [
    { name: 'two advances', ops: ['advance', 'advance'] },
    { name: 'an advance and a regenerate', ops: ['advance', 'regenerate'] },
    { name: 'a regenerate and an advance', ops: ['regenerate', 'advance'] },
    { name: 'two regenerates', ops: ['regenerate', 'regenerate'] },
    {
      name: 'advance, regenerate, advance',
      ops: ['advance', 'regenerate', 'advance'],
    },
    {
      name: 'regenerate, advance, regenerate, advance',
      ops: ['regenerate', 'advance', 'regenerate', 'advance'],
    },
  ];

  describe.each(interleavings)('concurrent $name', ({ ops }) => {
    test('neither loses nor duplicates a cycle', async () => {
      const { service, channelDB } = setup();

      await service.advanceChannel(channelId, now0);
      const initialStart = channelDB.state.channel.startTime;

      // Past two cycle boundaries, so every call wants to trim and build.
      const now = initialStart + 2 * cycleMs + 2_500;
      await Promise.all(
        ops.map((op) =>
          op === 'advance'
            ? service.advanceChannel(channelId, now)
            : service.regenerateChannel(channelId, now),
        ),
      );

      expectConsistentState(channelDB, now);
      // Only an advance trims. A cascade keeps the start time where it is.
      expect(channelDB.state.channel.startTime).toBe(
        ops.includes('advance') ? initialStart + 2 * cycleMs : initialStart,
      );

      // The state has converged: one more advance settles it, and the pass
      // after that finds nothing to do.
      await service.advanceChannel(channelId, now);
      expect(channelDB.state.channel.startTime).toBe(
        initialStart + 2 * cycleMs,
      );
      const savesBefore = channelDB.saves.length;
      await service.advanceChannel(channelId, now);
      expect(channelDB.saves).toHaveLength(savesBefore);
      expectConsistentState(channelDB, now);
    });
  });

  test('an unknown channel is ignored and does not block the known one', async () => {
    const { service, channelDB, builder } = setup();

    await Promise.all([
      service.advanceChannel(channelId, now0),
      service.advanceChannel('00000000-0000-4000-8000-0000000000ff', now0),
    ]);

    expectConsistentState(channelDB, now0);
    // Nothing was built for the missing channel.
    expect(
      builder.calls.every(
        (call) => call.startTime >= channelDB.state.channel.startTime,
      ),
    ).toBe(true);
  });
});
