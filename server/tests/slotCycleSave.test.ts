import type { FastifyInstance } from 'fastify';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import { ChannelDB } from '../src/db/ChannelDB.ts';
import type { ChannelLineupLock } from '../src/services/ChannelLineupLock.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import {
  createChannelViaApi,
  defaultTranscodeConfigId,
  makeTimeSlotSchedule,
  saveTimeSlotSchedule,
  seedCustomShow,
  seedPrograms,
} from './support/seed.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;
let programIds: string[];
let customShowId: string;
let transcodeConfigId: string;

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort(), {
    registerGuideTask: true,
  });

  programIds = await seedPrograms(60);
  customShowId = await seedCustomShow(programIds);
  transcodeConfigId = await defaultTranscodeConfigId();
}, 120_000);

afterAll(async () => {
  await app?.close();
});

function schedule() {
  return makeTimeSlotSchedule({ customShowId, maxDays: 3, slotsPerDay: 6 });
}

function loadLineup(channelId: string) {
  return container.get(ChannelDB).loadLineup(channelId);
}

// A slot save on a rebuilding channel writes a single pass of the schedule,
// then replaces it with the channel's first cycles under the same lock. The
// response must describe the cycles, not the pass it replaced.
describe('saving a schedule that rebuilds each cycle', () => {
  let channelId: string;
  let saveResponse: unknown;

  beforeAll(async () => {
    channelId = await createChannelViaApi(app, {
      number: 4002,
      name: 'Rebuilding',
      transcodeConfigId,
    });

    const res = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      schedule(),
      { rebuildEachCycle: true },
    );

    expect(res.statusCode).toBe(200);
    saveResponse = res.json();
  }, 120_000);

  test('the saved lineup is made of built cycles', async () => {
    const lineup = await loadLineup(channelId);

    expect(lineup.rebuildEachCycle).toBe(true);
    const cycles = lineup.cycles ?? [];
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles.reduce((sum, c) => sum + c.itemCount, 0)).toBe(
      lineup.items.length,
    );
  });

  test('the response matches the cycles, not the replaced pass', async () => {
    const reloaded = await container
      .get(ChannelDB)
      .loadCondensedLineup(channelId);

    expect(reloaded).not.toBeNull();
    const { scheduleEdit, ...lineup } = saveResponse as Record<string, unknown>;
    expect(lineup).toEqual(JSON.parse(JSON.stringify(reloaded)));

    // A new channel had no schedule before this save, so no places to keep.
    expect(scheduleEdit).toEqual({
      placesCarried: false,
      reason: 'no_schedule',
    });
  }, 60_000);
});

describe('the rebuild toggle on a slot save', () => {
  test('a save without the toggle keeps the stored value', async () => {
    const channelId = await createChannelViaApi(app, {
      number: 4003,
      transcodeConfigId,
    });

    const first = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      schedule(),
      { rebuildEachCycle: true },
    );
    expect(first.statusCode).toBe(200);

    const second = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      schedule(),
    );
    expect(second.statusCode).toBe(200);

    expect((await loadLineup(channelId)).rebuildEachCycle).toBe(true);
  }, 120_000);

  test('an on-demand channel never rebuilds', async () => {
    const channelId = await createChannelViaApi(app, {
      number: 4004,
      transcodeConfigId,
      onDemand: true,
    });

    const res = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      schedule(),
      { rebuildEachCycle: true },
    );
    expect(res.statusCode).toBe(200);

    const lineup = await loadLineup(channelId);
    expect(lineup.onDemandConfig).toBeDefined();
    expect(lineup.rebuildEachCycle).toBe(false);
  }, 120_000);
});

describe('deleting a schedule', () => {
  test('waits for the channel lineup lock', async () => {
    const channelId = await createChannelViaApi(app, {
      number: 4005,
      transcodeConfigId,
    });
    const saved = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      schedule(),
    );
    expect(saved.statusCode).toBe(200);

    // Hold the lock from outside the request, as a cycle boundary pass would.
    // The request must not run inside this callback, or reentrancy lets it in.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = container
      .get<ChannelLineupLock>(KEYS.ChannelLineupLock)
      .run(channelId, () => gate);

    let finished = false;
    const deleted = app
      .inject({ method: 'DELETE', url: `/api/channels/${channelId}/schedule` })
      .then((res) => {
        finished = true;
        return res;
      });

    await sleep(250);
    expect(finished).toBe(false);
    expect((await loadLineup(channelId)).schedule).toBeDefined();

    release();
    await held;

    expect((await deleted).statusCode).toBe(204);
    expect((await loadLineup(channelId)).schedule).toBeUndefined();
  }, 120_000);
});
