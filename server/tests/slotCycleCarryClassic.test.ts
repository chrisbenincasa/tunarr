import type { TimeSlotSchedule } from '@tunarr/types/api';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { chunk, uniq } from 'lodash-es';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import { ChannelDB } from '../src/db/ChannelDB.ts';
import type { LineupItem } from '../src/db/derived_types/Lineup.ts';
import { getAvailablePort } from '../src/util/net.ts';
import {
  createChannelViaApi,
  defaultTranscodeConfigId,
  makeTimeSlotSchedule,
  saveTimeSlotSchedule,
  seedCustomShow,
  seedPrograms,
  setProgrammingHours,
} from './support/seed.ts';
import { initTestApp } from './testServer.js';

const HourMs = 60 * 60 * 1000;
const ProgramCount = 60;

let app: FastifyInstance;
let programIds: string[];
let customShowId: string;
let otherProgramIds: string[];
let otherCustomShowId: string;
let transcodeConfigId: string;

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort(), {
    registerGuideTask: true,
  });

  programIds = await seedPrograms(ProgramCount);
  customShowId = await seedCustomShow(programIds);
  otherProgramIds = await seedPrograms(10, { titlePrefix: 'Other' });
  otherCustomShowId = await seedCustomShow(otherProgramIds);
  transcodeConfigId = await defaultTranscodeConfigId();

  // Builds far enough ahead that a slot added after the cut-over has aired.
  await setProgrammingHours(48);
}, 120_000);

afterAll(async () => {
  await app?.close();
});

// One slot a day, so every program comes from a single iterator and the
// channel's content is one walk through the playlist.
function oneSlotSchedule(order: 'next' | 'shuffle'): TimeSlotSchedule {
  const base = makeTimeSlotSchedule({
    customShowId,
    maxDays: 3,
    slotsPerDay: 1,
  });
  return {
    ...base,
    slots: base.slots.map((slot) => ({ ...slot, order })),
  };
}

// The one-slot schedule plus a slot for the other playlist at noon.
function withNoonSlot(schedule: TimeSlotSchedule): TimeSlotSchedule {
  return {
    ...schedule,
    slots: [
      ...schedule.slots,
      {
        type: 'custom-show',
        customShowId: otherCustomShowId,
        startTime: 12 * HourMs,
        order: 'next',
        direction: 'asc',
        id: randomUUID(),
      },
    ],
  };
}

type Airing = { startTime: number; items: readonly LineupItem[] };

async function loadAiring(channelId: string): Promise<Airing> {
  const channelDB = container.get(ChannelDB);
  const channel = await channelDB.getChannel(channelId);
  const lineup = await channelDB.loadLineup(channelId);
  return { startTime: channel!.startTime, items: lineup.items };
}

function itemAiringAt({ startTime, items }: Airing, at: number) {
  const total = items.reduce((sum, item) => sum + item.durationMs, 0);
  let offset = (at - startTime) % total;
  for (const item of items) {
    if (offset < item.durationMs) {
      return item;
    }
    offset -= item.durationMs;
  }
  throw new Error('No item airing');
}

function contentIds(
  items: readonly LineupItem[],
  fromCustomShowId = customShowId,
): string[] {
  return items.flatMap((item) =>
    item.type === 'content' && item.customShowId === fromCustomShowId
      ? [item.id]
      : [],
  );
}

// Builds a classic schedule that has been airing for 50 hours, then turns
// the rebuild toggle on. A classic build airs flex until its first slot
// starts, so 50 hours guarantees at least one full day of programs before
// today. A fresh start would land on a different program.
async function enableOnAiringChannel(
  number: number,
  classicSchedule: TimeSlotSchedule,
  {
    enabledSchedule = classicSchedule,
    beforeEnabling,
  }: {
    enabledSchedule?: TimeSlotSchedule;
    beforeEnabling?: (channelId: string) => Promise<void>;
  } = {},
) {
  const channelId = await createChannelViaApi(app, {
    number,
    transcodeConfigId,
    startTime: Date.now() - 50 * HourMs,
  });

  const classic = await saveTimeSlotSchedule(
    app,
    channelId,
    [...programIds, ...otherProgramIds],
    classicSchedule,
  );
  expect(classic.statusCode).toBe(200);
  await beforeEnabling?.(channelId);
  const before = await loadAiring(channelId);

  const enabled = await saveTimeSlotSchedule(
    app,
    channelId,
    [...programIds, ...otherProgramIds],
    enabledSchedule,
    { rebuildEachCycle: true },
  );
  expect(enabled.statusCode).toBe(200);
  const after = await loadAiring(channelId);

  return {
    before,
    after,
    scheduleEdit: (enabled.json() as { scheduleEdit?: unknown }).scheduleEdit,
  };
}

describe('turning on rebuild each cycle for an airing classic channel', () => {
  test('an ordered show continues from the program on air', async () => {
    const { before, after, scheduleEdit } = await enableOnAiringChannel(
      4101,
      oneSlotSchedule('next'),
    );

    expect(scheduleEdit).toEqual({ placesCarried: true });

    const now = Date.now();
    expect(itemAiringAt(after, now)).toEqual(itemAiringAt(before, now));

    const ids = contentIds(after.items);
    for (let i = 1; i < ids.length; i++) {
      const previous = programIds.indexOf(ids[i - 1]!);
      expect(programIds.indexOf(ids[i]!)).toBe((previous + 1) % ProgramCount);
    }
  }, 120_000);

  test('a shuffle finishes its pass before repeating', async () => {
    const { before, after, scheduleEdit } = await enableOnAiringChannel(
      4102,
      oneSlotSchedule('shuffle'),
    );

    expect(scheduleEdit).toEqual({ placesCarried: true });

    const now = Date.now();
    expect(itemAiringAt(after, now)).toEqual(itemAiringAt(before, now));

    for (const pass of chunk(contentIds(after.items), ProgramCount)) {
      expect(uniq(pass)).toHaveLength(pass.length);
    }
  }, 120_000);

  test('a slot added in the same save starts at its first program', async () => {
    const { after, scheduleEdit } = await enableOnAiringChannel(
      4103,
      oneSlotSchedule('next'),
      { enabledSchedule: withNoonSlot(oneSlotSchedule('next')) },
    );

    expect(scheduleEdit).toEqual({ placesCarried: true });
    expect(contentIds(after.items, otherCustomShowId)[0]).toBe(
      otherProgramIds[0],
    );
  }, 120_000);

  test('a classic lineup without a seed starts over', async () => {
    const { scheduleEdit } = await enableOnAiringChannel(
      4104,
      oneSlotSchedule('next'),
      {
        beforeEnabling: (channelId) =>
          container
            .get(ChannelDB)
            .saveLineup(channelId, { scheduleSeed: null })
            .then(() => undefined),
      },
    );

    expect(scheduleEdit).toEqual({ placesCarried: false, reason: 'no_seed' });
  }, 120_000);
});
