import type { Channel } from '@/db/schema/Channel.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { BuildSlotCycleCommand } from '../../commands/BuildSlotCycleCommand.ts';
import type { Lineup, LineupItem } from '../../db/derived_types/Lineup.ts';
import { CurrentLineupSchemaVersion } from '../../db/derived_types/Lineup.ts';
import type {
  IChannelDB,
  UpdateChannelLineupRequest,
} from '../../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { createChannel } from '../../testing/fakes/entityCreators.ts';
import { fixtureRandomSlotSchedule } from '../../testing/fakes/slotScheduleFixtures.ts';
import { ChannelLineupLock } from '../ChannelLineupLock.ts';
import type { TVGuideService } from '../TvGuideService.ts';
import type { BuiltCycle, CycleSnapshot } from './slotCycles.ts';
import { MaxCyclesPerPass } from './slotCycles.ts';
import { SlotCycleBoundaryService } from './SlotCycleBoundaryService.ts';

vi.mock('../TvGuideService.ts', () => ({ TVGuideService: class {} }));
vi.mock('@/services/TvGuideService.js', () => ({ TVGuideService: class {} }));

const oneHour = 60 * 60 * 1000;
const cycleMs = oneHour;
const channelId = '00000000-0000-4000-8000-00000000f00d';

// A whole number of cycles, so a start time one horizon back lands exactly on
// a boundary and the arithmetic in the assertions stays readable.
const programmingHours = 4;

type BuildRequest = {
  startTime: number;
  snapshot: CycleSnapshot | undefined;
};

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

function setup(
  lineup: Lineup,
  build?: (req: BuildRequest, index: number) => Promise<BuiltCycle>,
  channelOverrides: Partial<Channel> = {},
) {
  const state = {
    channel: createChannel({
      uuid: channelId,
      startTime: 0,
      duration: 0,
      ...channelOverrides,
    }),
    lineup,
  };

  const saves: UpdateChannelLineupRequest[] = [];
  const addedProgramIds: string[] = [];
  const buildRequests: BuildRequest[] = [];

  const defaultBuild = async (req: BuildRequest, index: number) => ({
    items: [
      {
        type: 'content',
        id: `p${index}`,
        durationMs: cycleMs,
      } satisfies LineupItem,
    ],
    durationMs: cycleMs,
    endSnapshot: {
      discardCount: (req.snapshot?.discardCount ?? 0) + 1,
      iteratorState: { iterators: {} },
    },
  });

  const channelDB = {
    loadChannelAndLineup: () =>
      Promise.resolve({
        channel: { ...state.channel },
        lineup: { ...state.lineup, items: [...state.lineup.items] },
      }),
    saveLineup: (_id: string, req: UpdateChannelLineupRequest) => {
      saves.push(req);
      return Promise.resolve(state.lineup);
    },
    updateChannelStartTime: (_id: string, newTime: number) => {
      state.channel.startTime = newTime;
      return Promise.resolve();
    },
    addChannelPrograms: (_id: string, programIds: string[]) => {
      addedProgramIds.push(...programIds);
    },
    getAllChannels: () => Promise.resolve([state.channel]),
  } as unknown as IChannelDB;

  const buildCommand = {
    execute: (req: BuildRequest) => {
      const index = buildRequests.length;
      buildRequests.push(req);
      return (build ?? defaultBuild)(req, index);
    },
  } as unknown as BuildSlotCycleCommand;

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  } as unknown as Logger;

  const service = new SlotCycleBoundaryService(
    channelDB,
    { xmlTvSettings: () => ({ programmingHours }) } as unknown as ISettingsDB,
    new ChannelLineupLock(),
    buildCommand,
    {
      updateCachedChannel: vi.fn().mockResolvedValue(undefined),
    } as unknown as TVGuideService,
    logger,
  );

  return { service, state, saves, addedProgramIds, buildRequests, logger };
}

describe('SlotCycleBoundaryService guards', () => {
  let now: number;

  beforeEach(() => {
    now = Date.now();
  });

  test('records every built cycle in the channel-programs table', async () => {
    const { service, addedProgramIds, saves } = setup(baseLineup());

    await service.initializeChannel(channelId, now);

    expect(saves).toHaveLength(1);
    // One program per built cycle, all of them in the join table.
    const built = saves[0]?.cycles ?? [];
    expect(built.length).toBeGreaterThan(1);
    expect(addedProgramIds).toEqual(built.map((_, i) => `p${i}`));
  });

  test('leaves an on-demand channel alone and says so once', async () => {
    const { service, saves, logger } = setup(
      baseLineup({ onDemandConfig: { state: 'paused', cursor: 0 } }),
    );

    await service.advanceChannel(channelId, now);
    await service.advanceChannel(channelId, now);
    await service.regenerateChannel(channelId, now);

    expect(saves).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain('on-demand');
  });

  test('stops at the cycle cap rather than building to a distant horizon', async () => {
    // One-minute cycles against a four-hour horizon would need 240 builds.
    const shortCycle = 60 * 1000;
    const { service, buildRequests, saves } = setup(
      baseLineup(),
      async (req) => ({
        items: [
          {
            type: 'content',
            id: `p${buildRequests.length}`,
            durationMs: shortCycle,
          } satisfies LineupItem,
        ],
        durationMs: shortCycle,
        endSnapshot: {
          discardCount: (req.snapshot?.discardCount ?? 0) + 1,
          iteratorState: { iterators: {} },
        },
      }),
    );

    await service.initializeChannel(channelId, now);

    expect(buildRequests).toHaveLength(MaxCyclesPerPass);
    expect(saves[0]?.cycles).toHaveLength(MaxCyclesPerPass);
  });

  test('restarts at the current period when a regenerate finds everything aired', async () => {
    const longAgo = now - 180 * 24 * oneHour;
    const { service, buildRequests } = setup(
      baseLineup({
        items: [{ type: 'content', id: 'old', durationMs: cycleMs }],
        cycles: [
          {
            itemCount: 1,
            durationMs: cycleMs,
            snapshot: { discardCount: 0, iteratorState: { iterators: {} } },
          },
        ],
      }),
      undefined,
      { startTime: longAgo },
    );

    await service.regenerateChannel(channelId, now);

    // Catch-up semantics: the first build starts at the current period, not
    // six months back, so no pass is run for the cycles in between.
    expect(buildRequests[0]?.startTime).toBeGreaterThanOrEqual(now - 60 * 1000);
    expect(buildRequests.length).toBeLessThanOrEqual(programmingHours + 1);
  });

  test('writes nothing when a build fails partway through a pass', async () => {
    const { service, saves, addedProgramIds } = setup(
      baseLineup(),
      async (req, index) => {
        if (index === 1) {
          throw new Error('worker exploded');
        }
        return {
          items: [
            {
              type: 'content',
              id: `p${index}`,
              durationMs: cycleMs,
            } satisfies LineupItem,
          ],
          durationMs: cycleMs,
          endSnapshot: {
            discardCount: (req.snapshot?.discardCount ?? 0) + 1,
            iteratorState: { iterators: {} },
          },
        };
      },
    );

    await expect(service.initializeChannel(channelId, now)).rejects.toThrow(
      'worker exploded',
    );
    expect(saves).toEqual([]);
    expect(addedProgramIds).toEqual([]);
  });

  test('keeps the old lineup, and stays quiet, when a schedule builds nothing', async () => {
    const { service, saves, logger } = setup(baseLineup(), () =>
      Promise.resolve({
        items: [],
        durationMs: 0,
        endSnapshot: { discardCount: 0, iteratorState: { iterators: {} } },
      }),
    );

    await service.initializeChannel(channelId, now);
    await service.initializeChannel(channelId, now);
    await service.advanceChannel(channelId, now);

    expect(saves).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
