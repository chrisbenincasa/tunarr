import { SaveableChannel } from '@tunarr/types';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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
    number: 999,
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

describe('POST /channels - transcode config validation', () => {
  test('rejects non-UUID transcodeConfigId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: {
        type: 'new',
        channel: makeChannelPayload('not-a-uuid'),
      },
    });

    expect(res.statusCode).toBe(400);
  });

  test('rejects non-existent transcodeConfigId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: {
        type: 'new',
        channel: makeChannelPayload(NON_EXISTENT_UUID),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toContain(NON_EXISTENT_UUID);
  });
});

describe('PUT /channels/:id - transcode config validation', () => {
  let existingChannelId: string;

  beforeAll(async () => {
    // Create a channel directly via DB to avoid GlobalScheduler issues in test
    const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
    const result = await channelDB.saveChannel(
      makeChannelPayload(validTranscodeConfigId) as SaveableChannel,
    );
    existingChannelId = result.channel.uuid;
  });

  test('rejects non-UUID transcodeConfigId', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${existingChannelId}`,
      payload: makeChannelPayload('not-a-uuid'),
    });

    expect(res.statusCode).toBe(400);
  });

  test('rejects non-existent transcodeConfigId', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${existingChannelId}`,
      payload: makeChannelPayload(NON_EXISTENT_UUID),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toContain(NON_EXISTENT_UUID);
  });
});
