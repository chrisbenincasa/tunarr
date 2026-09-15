import { SaveableChannel } from '@tunarr/types';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { v4 } from 'uuid';
import { container } from '../src/container.ts';
import { ChannelDB } from '../src/db/ChannelDB.ts';
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

async function createChannel(): Promise<string> {
  const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
  const result = await channelDB.saveChannel({
    ...makeChannelPayload(validTranscodeConfigId),
    name: 'Programming Validation Channel',
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
