import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort());
});

afterAll(async () => {
  await app?.close();
});

async function putFlags(body: Record<string, unknown>) {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/system/feature-flags',
    payload: body,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

async function getFlags() {
  const res = await app.inject({
    method: 'GET',
    url: '/api/system/feature-flags',
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().flags as Record<string, boolean>;
}

/**
 * `UpdateFeatureFlagsRequestSchema` was `FeatureFlagsSchema.partial()`, and
 * every flag carries `.default(false)`. `.partial()` wraps a default rather
 * than removing it, so all six flags arrived populated whatever the client
 * sent, and the handler's `Object.assign(file.featureFlags, req.body)` wrote
 * all six. Turning one flag on therefore turned every other flag off.
 */
describe('PUT /system/feature-flags - partial update', () => {
  test('turning one flag on does not turn the others off', async () => {
    await putFlags({
      proxyArtwork: true,
      tonemapEnabled: false,
      webvttSidecarEnabled: true,
      disableSearchSnapshotInBackup: false,
      disableVulkan: false,
      disableVaapiPad: false,
    });

    expect(await getFlags()).toMatchObject({
      proxyArtwork: true,
      webvttSidecarEnabled: true,
    });

    // Enable one unrelated flag, mentioning nothing else.
    await putFlags({ tonemapEnabled: true });

    expect(await getFlags()).toMatchObject({
      tonemapEnabled: true,
      // These were never mentioned and must survive.
      proxyArtwork: true,
      webvttSidecarEnabled: true,
    });
  });

  test('an empty body changes nothing', async () => {
    await putFlags({ proxyArtwork: true, disableVulkan: true });
    const before = await getFlags();

    await putFlags({});

    expect(await getFlags()).toEqual(before);
  });

  test('a flag can still be turned off explicitly', async () => {
    await putFlags({ proxyArtwork: true });
    expect((await getFlags()).proxyArtwork).toBe(true);

    await putFlags({ proxyArtwork: false });
    expect((await getFlags()).proxyArtwork).toBe(false);
  });

  test('rejects a non-boolean flag value', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/system/feature-flags',
      payload: { proxyArtwork: 'yes' },
    });

    expect(res.statusCode).toBe(400);
  });
});
