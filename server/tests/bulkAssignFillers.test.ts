import type { SaveableChannel } from '@tunarr/types';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { v4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import type { ChannelDB } from '../src/db/ChannelDB.ts';
import { DBAccess } from '../src/db/DBAccess.ts';
import { ChannelFillerShow } from '../src/db/schema/ChannelFillerShow.ts';
import { TranscodeConfigDB } from '../src/db/TranscodeConfigDB.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;
const channelIds: string[] = [];
const fillerIds: string[] = [];

function insertFillerShow(name: string) {
  const conn = DBAccess.instance.getConnection();
  if (!conn) {
    throw new Error('Expected a DB connection for the test');
  }
  const uuid = v4();
  conn.sqlite
    .prepare(
      'INSERT INTO filler_show (uuid, created_at, updated_at, name) VALUES (?, ?, ?, ?)',
    )
    .run(uuid, 0, 0, name);
  return uuid;
}

function fillersFor(channelId: string) {
  const drizzle = DBAccess.instance.drizzle;
  if (!drizzle) {
    throw new Error('Expected a Drizzle handle for the test');
  }
  return drizzle
    .select()
    .from(ChannelFillerShow)
    .where(eq(ChannelFillerShow.channelUuid, channelId))
    .all();
}

function bulkAssign(payload: unknown) {
  return app.inject({
    method: 'POST',
    url: '/api/channels/bulk/fillers',
    payload,
  });
}

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort());
  const defaultConfig = await container
    .get(TranscodeConfigDB)
    .getDefaultConfig();
  if (!defaultConfig) {
    throw new Error('Default transcode config not found after bootstrap');
  }

  const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
  for (const number of [901, 902]) {
    const result = await channelDB.saveChannel({
      name: `Bulk Filler ${number}`,
      number,
      duration: 60000,
      groupTitle: 'test',
      guideMinimumDuration: 30000,
      icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
      id: v4(),
      startTime: 0,
      stealth: false,
      offline: { mode: 'pic' },
      streamMode: 'hls',
      transcodeConfigId: defaultConfig.uuid,
      disableFillerOverlay: false,
      subtitlesEnabled: false,
    } as SaveableChannel);
    channelIds.push(result.channel.uuid);
  }

  fillerIds.push(insertFillerShow('Bulk A'), insertFillerShow('Bulk B'));
});

afterAll(async () => {
  await app?.close();
});

describe('POST /channels/bulk/fillers', () => {
  test('rejects duplicate channel IDs with a 400', async () => {
    const res = await bulkAssign({
      channelIds: [channelIds[0], channelIds[0]],
      fillers: [{ fillerShowId: fillerIds[0], weight: 1, cooldownSeconds: 0 }],
      mode: 'add',
    });

    expect(res.statusCode, res.body).toBe(400);
  });

  test('rejects duplicate filler IDs with a 400', async () => {
    const res = await bulkAssign({
      channelIds,
      fillers: [
        { fillerShowId: fillerIds[0], weight: 1, cooldownSeconds: 0 },
        { fillerShowId: fillerIds[0], weight: 2, cooldownSeconds: 0 },
      ],
      mode: 'add',
    });

    expect(res.statusCode, res.body).toBe(400);
  });

  test('rejects an unknown channel ID with a 400 and writes nothing', async () => {
    const unknownId = v4();
    const res = await bulkAssign({
      channelIds: [channelIds[0], unknownId],
      fillers: [{ fillerShowId: fillerIds[0], weight: 1, cooldownSeconds: 0 }],
      mode: 'add',
    });

    expect(res.statusCode, res.body).toBe(400);
    expect(res.json<{ message: string }>().message).toContain(unknownId);
    expect(fillersFor(channelIds[0])).toHaveLength(0);
  });

  test('rejects an unknown filler ID with a 400 and writes nothing', async () => {
    const unknownId = v4();
    const res = await bulkAssign({
      channelIds,
      fillers: [
        { fillerShowId: fillerIds[0], weight: 1, cooldownSeconds: 0 },
        { fillerShowId: unknownId, weight: 1, cooldownSeconds: 0 },
      ],
      mode: 'replace',
    });

    expect(res.statusCode, res.body).toBe(400);
    expect(res.json<{ message: string }>().message).toContain(unknownId);
    for (const channelId of channelIds) {
      expect(fillersFor(channelId)).toHaveLength(0);
    }
  });

  test('add mode skips pairs that already exist', async () => {
    const first = await bulkAssign({
      channelIds: [channelIds[0]],
      fillers: [{ fillerShowId: fillerIds[0], weight: 5, cooldownSeconds: 30 }],
      mode: 'add',
    });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toEqual({ added: 1, alreadyExisted: 0 });

    const second = await bulkAssign({
      channelIds,
      fillers: [
        { fillerShowId: fillerIds[0], weight: 1, cooldownSeconds: 0 },
        { fillerShowId: fillerIds[1], weight: 1, cooldownSeconds: 0 },
      ],
      mode: 'add',
    });
    expect(second.statusCode, second.body).toBe(200);
    expect(second.json()).toEqual({ added: 3, alreadyExisted: 1 });

    // The existing pair keeps its original weight and cooldown.

    const existing = fillersFor(channelIds[0]).find(
      (row) => row.fillerShowUuid === fillerIds[0],
    );
    expect(existing).toMatchObject({ weight: 5, cooldown: 30 });
    expect(fillersFor(channelIds[1])).toHaveLength(2);
  });

  test('replace mode drops every existing assignment on the channels', async () => {
    const res = await bulkAssign({
      channelIds,
      fillers: [{ fillerShowId: fillerIds[1], weight: 3, cooldownSeconds: 60 }],
      mode: 'replace',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ added: 2, alreadyExisted: 0 });

    for (const channelId of channelIds) {
      const rows = fillersFor(channelId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        fillerShowUuid: fillerIds[1],
        weight: 3,
        cooldown: 60,
      });
    }
  });
});
