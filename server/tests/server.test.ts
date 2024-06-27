import { ChannelSchema } from '@tunarr/types/schemas';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';
import { initOrm } from '../src/dao/dataSource.js';
import { Channel } from '../src/dao/entities/Channel.js';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;

beforeAll(async () => {
  // we use different ports to allow parallel testing
  app = await initTestApp(30001);
});

afterAll(async () => {
  // we close only the fastify app - it will close the database connection via onClose hook automatically
  await app?.close();
  await initOrm().then((orm) => orm.close());
});

test('list all channels', async () => {
  const orm = await initOrm();
  const em = orm.em.fork();

  const channel = em.create(Channel, {
    number: 1,
    guideMinimumDuration: 30,
    name: 'Channel 1',
    duration: 100,
    stealth: false,
    groupTitle: 'tv',
    startTime: new Date().getTime(),
    disableFillerOverlay: false,
    offline: { mode: 'pic' },
  });

  await em.persistAndFlush(channel);

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
