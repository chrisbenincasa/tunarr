import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getAvailablePort } from '../src/util/net.ts';
import { defaultTranscodeConfigId } from './support/seed.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;
let visibleId: string;
let stealthId: string;

const authorization = `Basic ${Buffer.from('admin:secret').toString('base64')}`;

async function createChannel(
  number: number,
  stealth: boolean,
  transcodeConfigId: string,
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/channels',
    headers: { authorization },
    payload: {
      type: 'new',
      channel: {
        name: `Channel ${number}`,
        number,
        duration: 0,
        groupTitle: 'test',
        guideMinimumDuration: 30000,
        icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
        id: '00000000-0000-0000-0000-000000000000',
        startTime: Date.now(),
        stealth,
        offline: { mode: 'pic' },
        streamMode: 'hls',
        transcodeConfigId,
        disableFillerOverlay: false,
        subtitlesEnabled: false,
      },
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json<{ id: string }>().id;
}

beforeAll(async () => {
  vi.stubEnv('TUNARR_BASIC_AUTH_USER', 'admin');
  vi.stubEnv('TUNARR_BASIC_AUTH_PASSWORD', 'secret');
  app = await initTestApp(await getAvailablePort(), {
    registerGuideTask: true,
  });

  const transcodeConfigId = await defaultTranscodeConfigId();
  visibleId = await createChannel(1, false, transcodeConfigId);
  stealthId = await createChannel(2, true, transcodeConfigId);
});

afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});

describe('GET /api/channels.m3u?channels= with basic auth on', () => {
  test('leaves stealth channels out without credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels.m3u?channels=1,2',
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).toContain(visibleId);
    expect(res.body).not.toContain(stealthId);
  });

  test('keeps stealth channels with valid credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels.m3u?channels=1,2',
      headers: { authorization },
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).toContain(visibleId);
    expect(res.body).toContain(stealthId);
  });

  test('sends an attachment only when asked', async () => {
    const plain = await app.inject({
      method: 'GET',
      url: '/api/channels.m3u?channels=1',
    });
    const download = await app.inject({
      method: 'GET',
      url: '/api/channels.m3u?channels=1&download=true',
    });

    expect(plain.headers['content-disposition']).toBeUndefined();
    expect(download.headers['content-disposition']).toBe(
      'attachment; filename="channels.m3u"',
    );
  });
});
