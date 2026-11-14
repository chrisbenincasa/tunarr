import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { TUNARR_ENV_VARS } from '../src/util/env.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

// The container reads these when it loads, so they are set before any import.
// TUNARR_USE_WORKER_POOL stays on: only the size of 0 turns the pool off. The
// real pool cannot start under vitest (see vitest.config.ts), so the server
// only boots here if size 0 binds the no-op pool.
vi.hoisted(() => {
  process.env.TUNARR_USE_WORKER_POOL = 'true';
  process.env.TUNARR_WORKER_POOL_SIZE = '0';
});

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv(TUNARR_ENV_VARS.MOUNT_DEBUG_ENDPOINTS, 'true');
  app = await initTestApp(await getAvailablePort());
});

afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});

describe('worker pool size 0', () => {
  test('debug status answers from the no-op pool', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/subprocess/status',
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ type: 'status', status: 'healthy' });
  });

  test('debug restart returns without waiting on a worker', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/subprocess/restart',
    });

    expect(res.statusCode, res.body).toBe(200);
  });
});
