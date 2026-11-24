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
import type { BuiltCycle, CycleSnapshot } from './slotCycles.ts';
import type { SlotIteratorState } from './slotIteratorState.ts';
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
  calls: {
    startTime: number;
    discardCount: number;
    iteratorState: SlotIteratorState | undefined;
  }[];
  replays: { startTime: number; programIds: readonly string[] }[];
  // The classic pass a replay reproduces.
  passItems: LineupItem[];
  // Changes what a classic replay produces. By default it reproduces
  // `passItems` exactly.
  replayItems?: (
    stored: LineupItem[],
    programIds: readonly string[],
  ) => LineupItem[];
};

// A classic pass of ten one-hour programs. Each one names the time its pass
// airs from, so expectConsistentState can check where the pass sits.
const classicPassMs = 10 * oneHour;

function classicItems(passStart: number): LineupItem[] {
  return Array.from({ length: 10 }, (_, i) => ({
    type: 'content',
    id: `c${i}@${passStart}#${i}`,
    durationMs: oneHour,
  }));
}

function contentId(item: LineupItem): string {
  if (item.type !== 'content') {
    throw new Error('expected a content item');
  }
  return item.id;
}

// The replayed pass checkpoints every two hours. Show A in the first slot has
// played c(n-1) by the checkpoint at n hours, and the first slot last played
// an hour before it.
function classicReplay(startTime: number, items: LineupItem[]): BuiltCycle {
  return {
    items,
    durationMs: totalDurationMs(items),
    endSnapshot: {
      discardCount: 10,
      iteratorState: {
        iterators: { 'slot:0': { type: 'ordered', lastProgramId: 'c9' } },
      },
    },
    checkpoints: [2, 4, 6, 8].map((hours) => ({
      offsetMs: hours * oneHour,
      discardCount: hours,
      iterators: {
        'slot:0': { type: 'ordered', lastProgramId: `c${hours - 1}` },
      },
      slotLastPlayedMs: { '0': startTime + (hours - 1) * oneHour },
    })),
  };
}

// Each cycle's items name the start time they were built for, so a lineup
// stitched together from stale reads is detectable.
function createFakeBuildCommand(): FakeBuilder {
  const calls: FakeBuilder['calls'] = [];
  const delays = [3, 0, 5, 1, 4, 2];

  const execute = async (req: {
    startTime: number;
    snapshot?: CycleSnapshot;
  }): Promise<BuiltCycle> => {
    const index = calls.length;
    calls.push({
      startTime: req.startTime,
      discardCount: req.snapshot?.discardCount ?? 0,
      iteratorState: req.snapshot?.iteratorState,
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
            // The fixture's first slot plays show A in order.
            'slot:0': {
              type: 'ordered',
              lastProgramId: `@${req.startTime}`,
            },
          },
        },
      },
    };
  };

  const builder: FakeBuilder = {
    command: undefined as unknown as BuildSlotCycleCommand,
    calls,
    replays: [],
    passItems: [],
  };

  const replayClassic = async (req: {
    programIds: readonly string[];
    startTime: number;
  }): Promise<BuiltCycle> => {
    builder.replays.push({
      startTime: req.startTime,
      programIds: req.programIds,
    });
    await tick(1);
    const stored = builder.passItems;
    return classicReplay(
      req.startTime,
      builder.replayItems?.(stored, req.programIds) ?? stored,
    );
  };

  builder.command = {
    execute,
    replayClassic,
  } as unknown as BuildSlotCycleCommand;
  return builder;
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

  describe('applyScheduleEdit', () => {
    // What a slot save leaves behind: the edited schedule, a new seed, a
    // single pass of items and no cycles.
    async function editAndSave(
      channelDB: FakeChannelDB,
      edit: (lineup: Lineup) => Partial<Lineup>,
    ) {
      const previous = {
        startTime: channelDB.state.channel.startTime,
        lineup: structuredClone(channelDB.state.lineup),
      };
      const {
        cycles: _cycles,
        nextCycleSnapshot: _next,
        ...rest
      } = channelDB.state.lineup;
      channelDB.state.lineup = {
        ...rest,
        scheduleSeed: [9, 9, 9],
        items: [{ type: 'offline', durationMs: oneHour }],
        ...edit(previous.lineup),
      };
      await tick(1);
      return previous;
    }

    const reverseSlots = (lineup: Lineup): Partial<Lineup> => {
      const schedule = lineup.schedule;
      if (schedule?.type !== 'random') {
        throw new Error('expected a random slot schedule');
      }
      return {
        schedule: { ...schedule, slots: [...schedule.slots].reverse() },
      };
    };

    test('keeps the program on air and carries each slot’s place', async () => {
      const { service, channelDB, builder } = setup();
      await service.advanceChannel(channelId, now0);

      const now = now0 + 20 * oneMinute;
      const startTime = channelDB.state.channel.startTime;
      const before = structuredClone(channelDB.state.lineup);
      const firstCycle = before.cycles?.[0];
      const secondCycleStart = startTime + (firstCycle?.durationMs ?? 0);
      expect(secondCycleStart).toBeGreaterThan(now);

      const previous = await editAndSave(channelDB, reverseSlots);
      const callsBefore = builder.calls.length;
      await service.applyScheduleEdit(channelId, previous, now);

      // The start time stays, and so does the cycle on air.
      expect(channelDB.state.channel.startTime).toBe(startTime);
      expect(
        channelDB.state.lineup.items.slice(0, firstCycle?.itemCount),
      ).toEqual(before.items.slice(0, firstCycle?.itemCount));

      // The edited schedule takes over at the next restart point. Show A
      // moved from the first slot to the last, and its place moved with it.
      // The new seed starts its RNG over.
      expect(builder.calls[callsBefore]).toEqual({
        startTime: secondCycleStart,
        discardCount: 0,
        iteratorState: {
          iterators: {
            'slot:4': { type: 'ordered', lastProgramId: `@${startTime}` },
          },
          slotLastPlayedMs: {},
        },
      });
      expectConsistentState(channelDB, now);
    });

    test('a channel whose cycles have all aired catches up with the carried places', async () => {
      const { service, channelDB, builder } = setup();
      await service.advanceChannel(channelId, now0);
      const lastSnapshot = channelDB.state.lineup.nextCycleSnapshot;

      const now = now0 + 3 * 24 * oneHour;
      const previous = await editAndSave(channelDB, reverseSlots);
      const callsBefore = builder.calls.length;
      await service.applyScheduleEdit(channelId, previous, now);

      const lastProgramId =
        lastSnapshot?.iteratorState.iterators['slot:0']?.type === 'ordered'
          ? lastSnapshot.iteratorState.iterators['slot:0'].lastProgramId
          : undefined;
      expect(lastProgramId).toBeDefined();
      expect(builder.calls[callsBefore]).toEqual({
        startTime: now - (now % oneMinute),
        discardCount: 0,
        iteratorState: {
          iterators: {
            'slot:4': { type: 'ordered', lastProgramId },
          },
          slotLastPlayedMs: {},
        },
      });
      expectConsistentState(channelDB, now);
    });

    // A classic channel one pass into its loop, 3.5 hours into the second
    // pass, saved with the same schedule and the toggle on.
    async function enableOnClassicChannel(lineup: Partial<Lineup> = {}) {
      const startTime = now0 - classicPassMs - 3.5 * oneHour;
      const passStart = startTime + classicPassMs;
      const ctx = setup(
        baseLineup({
          rebuildEachCycle: false,
          items: classicItems(passStart),
          ...lineup,
        }),
      );
      ctx.channelDB.state.channel.startTime = startTime;
      ctx.channelDB.state.channel.duration = classicPassMs;
      ctx.builder.passItems = classicItems(passStart);
      return { ...ctx, startTime, passStart };
    }

    const turnOn = () => ({ rebuildEachCycle: true });

    test('a classic channel carries each slot’s place from the replayed pass', async () => {
      const { service, channelDB, builder, startTime, passStart } =
        await enableOnClassicChannel();
      const previous = await editAndSave(channelDB, turnOn);

      const outcome = await service.applyScheduleEdit(
        channelId,
        previous,
        now0,
      );

      expect(outcome).toEqual({ placesCarried: true });
      expect(builder.replays).toEqual([
        { startTime, programIds: classicItems(passStart).map(contentId) },
      ]);

      // c3 is on air. The pass is kept through it, and the edited schedule
      // takes over at the 4 hour checkpoint with the state recorded there.
      // The cooldown moves forward by the pass already looped.
      expect(channelDB.state.channel.startTime).toBe(passStart);
      expect(channelDB.state.lineup.items.slice(0, 4)).toEqual(
        classicItems(passStart).slice(0, 4),
      );
      expect(channelDB.state.lineup.cycles?.[0]).not.toHaveProperty(
        'checkpoints',
      );
      expect(builder.calls[0]).toEqual({
        startTime: passStart + 4 * oneHour,
        discardCount: 0,
        iteratorState: {
          iterators: { 'slot:0': { type: 'ordered', lastProgramId: 'c3' } },
          slotLastPlayedMs: { '0': passStart + 3 * oneHour },
        },
      });
      expectConsistentState(channelDB, now0);
    });

    test('a recorded program list is the only one replayed', async () => {
      const { service, channelDB, builder, startTime } =
        await enableOnClassicChannel({ scheduleProgramIds: ['p2', 'p1'] });
      const previous = await editAndSave(channelDB, turnOn);

      const outcome = await service.applyScheduleEdit(
        channelId,
        previous,
        now0,
        ['p9'],
      );

      expect(outcome).toEqual({ placesCarried: true });
      expect(builder.replays).toEqual([
        { startTime, programIds: ['p2', 'p1'] },
      ]);
    });

    test('an older lineup tries each program list until one replays what aired', async () => {
      const { service, channelDB, builder, passStart } =
        await enableOnClassicChannel();
      builder.replayItems = (items, programIds) =>
        programIds.join() === 'p9'
          ? items
          : items.map((item, i) =>
              i === 1 ? { type: 'offline', durationMs: item.durationMs } : item,
            );
      const previous = await editAndSave(channelDB, turnOn);

      const outcome = await service.applyScheduleEdit(
        channelId,
        previous,
        now0,
        ['p9'],
      );

      expect(outcome).toEqual({ placesCarried: true });
      expect(builder.replays.map(({ programIds }) => programIds)).toEqual([
        classicItems(passStart).map(contentId),
        [],
        ['p9'],
      ]);
      expectConsistentState(channelDB, now0);
    });

    test('a classic replay that differs from what aired starts fresh', async () => {
      const { service, channelDB, builder } = await enableOnClassicChannel();
      builder.replayItems = (items) =>
        items.map((item, i) =>
          i === 1 ? { type: 'offline', durationMs: item.durationMs } : item,
        );
      const previous = await editAndSave(channelDB, turnOn);

      const outcome = await service.applyScheduleEdit(
        channelId,
        previous,
        now0,
      );

      expect(outcome).toEqual({
        placesCarried: false,
        reason: 'replay_mismatch',
      });
      expect(builder.calls[0]).toEqual({
        startTime: now0 - (now0 % oneMinute),
        discardCount: 0,
        iteratorState: undefined,
      });
      expectConsistentState(channelDB, now0);
    });

    test('a classic channel without a seed starts fresh without a replay', async () => {
      const { service, channelDB, builder } = await enableOnClassicChannel({
        scheduleSeed: undefined,
      });
      const previous = await editAndSave(channelDB, turnOn);

      const outcome = await service.applyScheduleEdit(
        channelId,
        previous,
        now0,
      );

      expect(outcome).toEqual({ placesCarried: false, reason: 'no_seed' });
      expect(builder.replays).toEqual([]);
      expect(builder.calls[0]?.iteratorState).toBeUndefined();
      expectConsistentState(channelDB, now0);
    });

    test('a classic channel with nothing aired starts fresh', async () => {
      const { service, channelDB, builder } = setup(
        baseLineup({ rebuildEachCycle: false }),
      );
      const previous = await editAndSave(channelDB, turnOn);

      const outcome = await service.applyScheduleEdit(
        channelId,
        previous,
        now0,
      );

      expect(outcome).toEqual({ placesCarried: false, reason: 'not_started' });
      expect(builder.calls[0]).toEqual({
        startTime: now0 - (now0 % oneMinute),
        discardCount: 0,
        iteratorState: undefined,
      });
      expectConsistentState(channelDB, now0);
    });
  });
});
