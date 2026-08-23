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
let transcodeConfigId: string;
let channelId: string;

function channelPayload(): Partial<SaveableChannel> {
  return {
    name: 'Write Contract Channel',
    number: 901,
    duration: 60000,
    groupTitle: 'test',
    guideMinimumDuration: 30000,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    id: '00000000-0000-0000-0000-000000000000',
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
  const defaultConfig = await container
    .get(TranscodeConfigDB)
    .getDefaultConfig();
  if (!defaultConfig) {
    throw new Error('Default transcode config not found after bootstrap');
  }
  transcodeConfigId = defaultConfig.uuid;

  const created = await container
    .get<ChannelDB>(KEYS.ChannelDB)
    .saveChannel(channelPayload() as SaveableChannel);
  channelId = created.channel.uuid;
});

afterAll(async () => {
  await app?.close();
});

async function put(body: Record<string, unknown>) {
  return await app.inject({
    method: 'PUT',
    url: `/api/channels/${channelId}`,
    payload: body,
  });
}

/**
 * These used to answer 200 and store a different value than the one submitted.
 * The channel *response* schema stays lenient, so existing rows still load —
 * only the request body is strict.
 */
describe('PUT /channels/:id - values are stored as submitted or rejected', () => {
  test('accepts a valid channel', async () => {
    const res = await put(channelPayload());
    expect(res.statusCode, res.body).toBe(200);
  });

  test('rejects a watermark opacity outside 0-100', async () => {
    const res = await put({
      ...channelPayload(),
      watermark: {
        enabled: true,
        width: 10,
        verticalMargin: 5,
        horizontalMargin: 5,
        opacity: 150,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  test('rejects an unrecognised fadeConfig programType', async () => {
    const res = await put({
      ...channelPayload(),
      watermark: {
        enabled: true,
        width: 10,
        verticalMargin: 5,
        horizontalMargin: 5,
        fadeConfig: [{ programType: 'movies', periodMins: 5 }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  test('rejects a misspelled icon position', async () => {
    const res = await put({
      ...channelPayload(),
      icon: { path: '', width: 0, duration: 0, position: 'centre' },
    });

    expect(res.statusCode).toBe(400);
  });

  test('stores a valid watermark opacity as submitted', async () => {
    const res = await put({
      ...channelPayload(),
      watermark: {
        enabled: true,
        width: 10,
        verticalMargin: 5,
        horizontalMargin: 5,
        opacity: 42,
      },
    });

    expect(res.statusCode, res.body).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}`,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().watermark.opacity).toBe(42);
  });
});
