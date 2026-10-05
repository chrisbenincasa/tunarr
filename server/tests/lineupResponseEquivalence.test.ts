import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import { ChannelDB } from '../src/db/ChannelDB.ts';
import {
  createChannelViaApi,
  defaultTranscodeConfigId,
  makeTimeSlotSchedule,
  saveTimeSlotSchedule,
  seedPrograms,
} from './support/seed.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

/**
 * The time-slot save path builds its response from the programs it already
 * materialized, instead of reloading the whole lineup from the database. That
 * removed a second relational query and a second full materialization — around
 * 200ms of blocked event loop on a large lineup — but it also means two
 * different code paths now produce the same API response.
 *
 * These pin them together. A drift here is invisible in normal use until the
 * programming editor renders something subtly wrong.
 */
describe('condensed lineup response equivalence', () => {
  let app: FastifyInstance;
  let channelId: string;
  let saveResponse: unknown;

  beforeAll(async () => {
    app = await initTestApp(await getAvailablePort(), {
      registerGuideTask: true,
    });

    const programIds = await seedPrograms(60);
    const transcodeConfigId = await defaultTranscodeConfigId();
    channelId = await createChannelViaApi(app, {
      number: 4001,
      name: 'Equivalence',
      transcodeConfigId,
    });

    const res = await saveTimeSlotSchedule(
      app,
      channelId,
      programIds,
      makeTimeSlotSchedule({ maxDays: 3, slotsPerDay: 6 }),
    );

    expect(res.statusCode).toBe(200);
    saveResponse = res.json();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  test('the save response is not an empty or all-flex lineup', () => {
    const body = saveResponse as {
      lineup: { type: string }[];
      programs: Record<string, unknown>;
    };

    // Guards the test itself. If seeding failed, both paths would agree on
    // nothing and the comparison below would pass while proving nothing.
    expect(body.lineup.length).toBeGreaterThan(0);
    expect(body.lineup.some((i) => i.type === 'content')).toBe(true);
    expect(Object.keys(body.programs).length).toBeGreaterThan(0);
  });

  test('matches what a full reload produces', async () => {
    const reloaded = await container
      .get(ChannelDB)
      .loadCondensedLineup(channelId);

    expect(reloaded).not.toBeNull();
    // Round-tripped through JSON because the save response came back over HTTP
    // and has already lost undefined-valued keys and class identity.
    expect(saveResponse).toEqual(JSON.parse(JSON.stringify(reloaded)));
  }, 60_000);
});
