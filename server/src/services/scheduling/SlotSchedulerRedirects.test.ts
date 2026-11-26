import type {
  RandomSlot,
  RandomSlotSchedule,
  TimeSlot,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import { randomUUID } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';
import type { CustomShowDB } from '../../db/CustomShowDB.ts';
import type { FillerDB } from '../../db/FillerListDB.ts';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import type { ProgramDB } from '../../db/ProgramDB.ts';
import type { SmartCollectionsDB } from '../../db/SmartCollectionsDB.ts';
import { createChannelOrm } from '../../testing/fakes/entityCreators.ts';
import { ScheduleValidationError } from '../../types/errors.ts';
import { SlotSchedulerService } from './RandomSlotSchedulerService.ts';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';
import { TimeSlotSchedulerService } from './TimeSlotSchedulerService.ts';

const oneHour = 60 * 60 * 1000;
const startTime = Date.UTC(2024, 0, 1);

const liveChannelId = randomUUID();
const deletedChannelId = randomUUID();

function makeHelper() {
  const channelDB = {
    getChannel: vi.fn((id: string) =>
      Promise.resolve(
        id === liveChannelId
          ? createChannelOrm({ uuid: liveChannelId, number: 2 })
          : undefined,
      ),
    ),
  } as unknown as IChannelDB;
  const programDB = {
    getProgramsByIds: vi.fn().mockResolvedValue([]),
    getProgramGroupings: vi.fn().mockResolvedValue({}),
  } as unknown as ProgramDB;
  const fillerDB = {
    getFillerListsByIds: vi.fn().mockResolvedValue([]),
  } as unknown as FillerDB;
  const smartCollectionsDB = {
    getByIds: vi.fn().mockResolvedValue([]),
  } as unknown as SmartCollectionsDB;
  const customShowDB = {} as unknown as CustomShowDB;

  return new SlotSchedulerHelper(
    customShowDB,
    fillerDB,
    programDB,
    smartCollectionsDB,
    channelDB,
  );
}

function timeSchedule(redirectChannelId: string): TimeSlotSchedule {
  const slots: TimeSlot[] = [
    {
      id: randomUUID(),
      type: 'redirect',
      channelId: redirectChannelId,
      startTime: 0,
    },
    { id: randomUUID(), type: 'flex', startTime: 12 * oneHour },
  ];
  return {
    type: 'time',
    flexPreference: 'end',
    latenessMs: 0,
    maxDays: 1,
    overflow: { type: 'duration', maxMs: 0 },
    padMs: 1,
    period: 'day',
    slots,
    timeZoneOffset: 0,
  };
}

function randomSchedule(redirectChannelId: string): RandomSlotSchedule {
  const slots: RandomSlot[] = [
    {
      id: randomUUID(),
      type: 'redirect',
      channelId: redirectChannelId,
      weight: 1,
      cooldownMs: 0,
      durationSpec: { type: 'fixed', durationMs: oneHour },
    },
  ];
  return {
    type: 'random',
    flexPreference: 'end',
    maxDays: 1,
    padMs: 1,
    padStyle: 'slot',
    randomDistribution: 'none',
    lockWeights: false,
    slots,
  };
}

function scheduleTime(channelId: string, strictValidation: boolean) {
  return new TimeSlotSchedulerService(makeHelper()).schedule({
    type: 'programs',
    programIds: [],
    schedule: timeSchedule(channelId),
    seed: [42],
    startTime,
    strictValidation,
  });
}

function scheduleRandom(channelId: string, strictValidation: boolean) {
  return new SlotSchedulerService(makeHelper()).schedule({
    type: 'programs',
    programIds: [],
    schedule: randomSchedule(channelId),
    seed: [42],
    startTime,
    strictValidation,
  });
}

const schedulers = [
  ['time slots', scheduleTime],
  ['random slots', scheduleRandom],
] as const;

describe.each(schedulers)('redirect slots in %s', (_label, schedule) => {
  test('a redirect to a deleted channel plays flex during regeneration', async () => {
    const result = await schedule(deletedChannelId, false);

    expect(result.lineup.length).toBeGreaterThan(0);
    expect(result.lineup.some((item) => item.type === 'redirect')).toBe(false);
    expect(result.lineup.every((item) => item.type === 'flex')).toBe(true);
  });

  test('a redirect to an existing channel still produces redirect items', async () => {
    const result = await schedule(liveChannelId, false);

    const redirects = result.lineup.filter((item) => item.type === 'redirect');
    expect(redirects.length).toBeGreaterThan(0);
    for (const item of redirects) {
      expect(item).toMatchObject({ channel: liveChannelId });
    }
  });

  test('a strict save still rejects a redirect to a deleted channel', async () => {
    await expect(schedule(deletedChannelId, true)).rejects.toThrow(
      ScheduleValidationError,
    );
    await expect(schedule(deletedChannelId, true)).rejects.toThrow(
      `references channel ${deletedChannelId}, which does not exist`,
    );
  });
});
