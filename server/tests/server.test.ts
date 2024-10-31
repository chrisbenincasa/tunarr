import { ChannelSchema } from '@tunarr/types/schemas';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;

beforeAll(async () => {
  // we use different ports to allow parallel testing
  app = await initTestApp(30001);
});

afterAll(async () => {
  // we close only the fastify app - it will close the database connection via onClose hook automatically
  await app?.close();
});

test('list all channels', async () => {
  // mimic the http request via `app.inject()`
  const res = await app.inject({
    method: 'get',
    url: '/api/channels',
  });

  // assert it was successful response
  expect(res.statusCode).toBe(200);

  const parsed = z.array(ChannelSchema).safeParse(res.json());
  expect(parsed.success).toBe(true);

  if (parsed.success) {
    // expect(parsed.data).toMatchObject([channel]);
  }
});
