import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import { ChannelDB } from '../src/db/ChannelDB.ts';
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

// A slot save on a rebuilding channel writes a single pass of the schedule,
// then replaces it with the channel's first cycles under the same lock. The
// response must describe the cycles, not the pass it replaced.
describe('saving a schedule that rebuilds each cycle', () => {
  let app: FastifyInstance;
  let channelId: string;
  let saveResponse: unknown;

  beforeAll(async () => {
    app = await initTestApp(await getAvailablePort(), {
      registerGuideTask: true,
    });

    const programIds = await seedPrograms(60);
    const customShowId = await seedCustomShow(programIds);
    channelId = await createChannelViaApi(app, {
      number: 4002,
      name: 'Rebuilding',
      transcodeConfigId: await defaultTranscodeConfigId(),
    });

    const res = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      makeTimeSlotSchedule({ customShowId, maxDays: 3, slotsPerDay: 6 }),
      { rebuildEachCycle: true },
    );

    expect(res.statusCode).toBe(200);
    saveResponse = res.json();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  test('the saved lineup is made of built cycles', async () => {
    const lineup = await container.get(ChannelDB).loadLineup(channelId);

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
    expect(saveResponse).toEqual(JSON.parse(JSON.stringify(reloaded)));
  }, 60_000);
});
