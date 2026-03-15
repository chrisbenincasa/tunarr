import { faker } from '@faker-js/faker';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await initTestApp(30002);
});

afterAll(async () => {
  await app?.close();
});

test('native-playback returns 404 for unknown channel', async () => {
  const res = await app.inject({
    method: 'GET',
    url: `/api/channels/${faker.string.uuid()}/native-playback`,
  });

  expect(res.statusCode).toBe(404);
});

test('item-stream returns 404 for unknown channel', async () => {
  const res = await app.inject({
    method: 'GET',
    url: `/stream/channels/${faker.string.uuid()}/item-stream.ts?t=0`,
  });

  expect(res.statusCode).toBe(404);
});
