import { SaveableChannel } from '@tunarr/types';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { v4 } from 'uuid';
import { container } from '../src/container.ts';
import { ChannelDB } from '../src/db/ChannelDB.ts';
import { CustomShowDB } from '../src/db/CustomShowDB.ts';
import { FileSystemService } from '../src/services/FileSystemService.ts';
import { TranscodeConfigDB } from '../src/db/TranscodeConfigDB.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;
let validTranscodeConfigId: string;

const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

function makeChannelPayload(
  transcodeConfigId: string,
): Partial<SaveableChannel> {
  return {
    name: 'Test Channel',
    number: 8001,
    duration: 60000,
    groupTitle: 'test',
    guideMinimumDuration: 30000,
    icon: {
      path: '',
      width: 0,
      duration: 0,
      position: 'bottom-right',
    },
    id: NON_EXISTENT_UUID,
    startTime: 0,
    stealth: false,
    offline: { mode: 'pic' },
    streamMode: 'hls',
    transcodeConfigId,
    disableFillerOverlay: false,
    subtitlesEnabled: false,
  };
}

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort());
  const transcodeConfigDB = container.get(TranscodeConfigDB);
  const defaultConfig = await transcodeConfigDB.getDefaultConfig();
  if (!defaultConfig) {
    throw new Error('Default transcode config not found after bootstrap');
  }
  validTranscodeConfigId = defaultConfig.uuid;
});

afterAll(async () => {
  await app?.close();
});

let nextChannelNumber = 8001;

async function createChannel(): Promise<string> {
  const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
  const result = await channelDB.saveChannel({
    ...makeChannelPayload(validTranscodeConfigId),
    name: 'Programming Validation Channel',
    number: nextChannelNumber++,
  } as SaveableChannel);
  return result.channel.uuid;
}

describe('POST /channels/:id/programming - slot group validation on the save path', () => {
  test('rejects a schedule whose slots share an iterationGroup with mismatched ordering', async () => {
    const channelId = await createChannel();
    const groupId = v4();

    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: {
        type: 'time',
        programs: [],
        schedule: {
          type: 'time',
          flexPreference: 'distribute',
          latenessMs: 0,
          maxDays: 1,
          padMs: 0,
          period: 'day',
          timeZoneOffset: 0,
          slots: [
            {
              type: 'movie',
              id: v4(),
              startTime: 0,
              order: 'next',
              direction: 'asc',
              iterationGroup: groupId,
            },
            {
              type: 'movie',
              id: v4(),
              startTime: 0,
              order: 'shuffle',
              direction: 'asc',
              iterationGroup: groupId,
            },
          ],
        },
      },
    });

    // The two slots share an iterationGroup but disagree on ordering — the
    // schedule must be rejected on the save path just like the preview
    // endpoints reject it, instead of being persisted and regenerated badly.
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('mismatched orderings');
  });
});

describe('rejected programming leaves stored state unchanged', () => {
  const oneHour = 60 * 60 * 1000;

  async function saveFlexLineup(channelId: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: {
        type: 'manual',
        lineup: [{ type: 'flex', duration: oneHour }],
      },
    });
    expect(res.statusCode).toBe(200);
  }

  async function snapshot(channelId: string) {
    const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
    const channel = await channelDB.getChannel(channelId);
    const cached = await channelDB.loadLineup(channelId);
    const file = JSON.parse(
      await readFile(
        container.get(FileSystemService).getChannelLineupPath(channelId),
        'utf-8',
      ),
    ) as { items: unknown };
    return {
      duration: channel?.duration,
      cachedItems: structuredClone(cached.items),
      fileItems: file.items,
    };
  }

  async function createEmptyCustomShow() {
    return container.get(CustomShowDB).createShow({
      name: 'Empty Show',
      programs: [],
      syncExternalPlaylistId: null,
      syncMediaSourceId: null,
      syncMediaSourceType: null,
    });
  }

  const randomSchedule = (
    customShowId: string,
    durationSpec: Record<string, unknown>,
  ) => ({
    type: 'random',
    flexPreference: 'end',
    maxDays: 0,
    padMs: 1,
    padStyle: 'slot',
    randomDistribution: 'none',
    slots: [
      {
        id: v4(),
        type: 'custom-show',
        customShowId,
        order: 'next',
        direction: 'asc',
        weight: 1,
        cooldownMs: 0,
        durationSpec,
      },
    ],
  });

  test('a random schedule that references an empty custom show is rejected', async () => {
    const channelId = await createChannel();
    await saveFlexLineup(channelId);
    const before = await snapshot(channelId);
    const customShowId = await createEmptyCustomShow();

    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: {
        type: 'random',
        programs: [],
        schedule: randomSchedule(customShowId, {
          type: 'dynamic',
          programCount: 1,
        }),
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Slot 0');
    expect(res.body).toContain(customShowId);
    expect(await snapshot(channelId)).toEqual(before);

    const version = await app.inject({ method: 'GET', url: '/api/version' });
    expect(version.statusCode).toBe(200);
  });

  test('a random schedule with a zero fixed duration is rejected', async () => {
    const channelId = await createChannel();
    await saveFlexLineup(channelId);
    const before = await snapshot(channelId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: {
        type: 'random',
        programs: [],
        schedule: randomSchedule(v4(), { type: 'fixed', durationMs: 0 }),
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Slot 0');
    expect(await snapshot(channelId)).toEqual(before);
  });

  test('random and time previews reject an empty custom show', async () => {
    const channelId = await createChannel();
    const customShowId = await createEmptyCustomShow();

    const random = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/schedule-slots`,
      payload: {
        schedule: randomSchedule(customShowId, {
          type: 'dynamic',
          programCount: 1,
        }),
      },
    });
    expect(random.statusCode).toBe(400);
    expect(random.body).toContain(customShowId);

    const time = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/schedule-time-slots`,
      payload: {
        schedule: {
          type: 'time',
          flexPreference: 'end',
          latenessMs: 0,
          maxDays: 1,
          padMs: oneHour,
          period: 'day',
          timeZoneOffset: 0,
          slots: [
            {
              id: v4(),
              type: 'custom-show',
              customShowId,
              startTime: 0,
              order: 'next',
              direction: 'asc',
            },
          ],
        },
      },
    });
    expect(time.statusCode).toBe(400);
    expect(time.body).toContain(customShowId);
  });

  test('a manual lineup with zero-duration content is rejected', async () => {
    const channelId = await createChannel();
    await saveFlexLineup(channelId);
    const before = await snapshot(channelId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: {
        type: 'manual',
        lineup: [{ type: 'content', id: v4(), duration: 0 }],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Lineup item 0');
    expect(await snapshot(channelId)).toEqual(before);
  });

  test('a manual lineup with an unknown program is rejected', async () => {
    const channelId = await createChannel();
    await saveFlexLineup(channelId);
    const before = await snapshot(channelId);
    const missingId = v4();

    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: {
        type: 'manual',
        lineup: [{ type: 'content', id: missingId, duration: oneHour }],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain(missingId);
    expect(await snapshot(channelId)).toEqual(before);
  });

  test('an empty manual lineup is still accepted', async () => {
    const channelId = await createChannel();
    await saveFlexLineup(channelId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/programming`,
      payload: { type: 'manual', lineup: [] },
    });

    expect(res.statusCode).toBe(200);
    const after = await snapshot(channelId);
    expect(after.cachedItems).toEqual([]);
    expect(after.duration).toBe(0);
  });
});
