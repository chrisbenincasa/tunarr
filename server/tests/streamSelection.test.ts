import type { SaveableChannel } from '@tunarr/types';
import type {
  StreamSelectionProfile,
  StreamSelectionProfileWithUsage,
} from '@tunarr/types/schemas';
import { BuiltInStreamSelectionProfileId } from '@tunarr/types/schemas';
import type { FastifyInstance } from 'fastify';
import { v4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import type { ChannelDB } from '../src/db/ChannelDB.ts';
import type { ISettingsDB } from '../src/db/interfaces/ISettingsDB.ts';
import { FillerShow } from '../src/db/schema/FillerShow.ts';
import type { DrizzleDBAccess } from '../src/db/schema/index.ts';
import { TranscodeConfigDB } from '../src/db/TranscodeConfigDB.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;
let transcodeConfigId: string;
let nextChannelNumber = 500;

const NON_EXISTENT_UUID = '00000000-0000-4000-8000-00000000ffff';

function makeChannelPayload(
  overrides: Partial<SaveableChannel> = {},
): SaveableChannel {
  return {
    name: 'Stream Selection Channel',
    // Leave gaps: copying a channel takes the next free number.
    number: (nextChannelNumber += 10),
    duration: 60000,
    groupTitle: 'test',
    guideMinimumDuration: 30000,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    id: NON_EXISTENT_UUID,
    startTime: 0,
    stealth: false,
    offline: { mode: 'pic' },
    streamMode: 'hls',
    transcodeConfigId,
    disableFillerOverlay: false,
    subtitlesEnabled: false,
    ...overrides,
  };
}

async function createProfile(name: string): Promise<StreamSelectionProfile> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/stream-selection-profiles',
    payload: {
      name,
      rules: [
        {
          condition: 'true',
          audioAction: { type: 'default' },
          subtitleAction: { type: 'disable' },
        },
      ],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json<StreamSelectionProfile>();
}

async function createChannel(overrides: Partial<SaveableChannel> = {}) {
  const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
  const result = await channelDB.saveChannel(makeChannelPayload(overrides));
  return result.channel.uuid;
}

async function getChannelProfileId(channelId: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/channels/${channelId}`,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ streamSelectionProfileId: string | null }>()
    .streamSelectionProfileId;
}

async function listProfiles() {
  const res = await app.inject({
    method: 'GET',
    url: '/api/stream-selection-profiles',
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<StreamSelectionProfileWithUsage[]>();
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
});

afterAll(async () => {
  await app?.close();
});

describe('built-in profile', () => {
  test('is seeded, locked, and the default', async () => {
    const builtIn = (await listProfiles()).find(
      (p) => p.uuid === BuiltInStreamSelectionProfileId,
    );
    expect(builtIn).toMatchObject({ locked: true, isDefault: true });
  });

  test('cannot be edited', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/stream-selection-profiles/${BuiltInStreamSelectionProfileId}`,
      payload: {
        name: 'Renamed',
        rules: [
          {
            condition: 'true',
            audioAction: { type: 'default' },
            subtitleAction: { type: 'disable' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  test('cannot be deleted', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/stream-selection-profiles/${BuiltInStreamSelectionProfileId}`,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('channel assignment', () => {
  test('sets, keeps, and clears the channel profile', async () => {
    const profile = await createProfile('Channel profile');
    const channelId = await createChannel();

    const setRes = await app.inject({
      method: 'PUT',
      url: `/api/channels/${channelId}`,
      payload: makeChannelPayload({ streamSelectionProfileId: profile.uuid }),
    });
    expect(setRes.statusCode, setRes.body).toBe(200);
    expect(await getChannelProfileId(channelId)).toBe(profile.uuid);

    // Omitting the field leaves the assignment unchanged.
    const keepRes = await app.inject({
      method: 'PUT',
      url: `/api/channels/${channelId}`,
      payload: makeChannelPayload({ name: 'Renamed' }),
    });
    expect(keepRes.statusCode, keepRes.body).toBe(200);
    expect(await getChannelProfileId(channelId)).toBe(profile.uuid);

    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/channels/${channelId}`,
      payload: makeChannelPayload({ streamSelectionProfileId: null }),
    });
    expect(clearRes.statusCode, clearRes.body).toBe(200);
    expect(await getChannelProfileId(channelId)).toBeNull();
  });

  test('rejects a profile that does not exist', async () => {
    const channelId = await createChannel();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${channelId}`,
      payload: makeChannelPayload({
        streamSelectionProfileId: NON_EXISTENT_UUID,
      }),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toContain(NON_EXISTENT_UUID);
  });

  test('copying a channel carries its profile', async () => {
    const profile = await createProfile('Copied profile');
    const channelId = await createChannel({
      streamSelectionProfileId: profile.uuid,
    });

    const copy = await container
      .get<ChannelDB>(KEYS.ChannelDB)
      .copyChannel(channelId);

    expect(copy.channel.streamSelectionProfileId).toBe(profile.uuid);
  });
});

describe('profile usage and deletion', () => {
  test('lists the channels that use a profile', async () => {
    const profile = await createProfile('Used profile');
    const channelId = await createChannel({
      streamSelectionProfileId: profile.uuid,
    });

    const listed = (await listProfiles()).find((p) => p.uuid === profile.uuid);

    expect(listed?.usage.channels.map((c) => c.uuid)).toEqual([channelId]);
    expect(listed?.isDefault).toBe(false);
  });

  test('deleting a profile clears its assignments and the default pointer', async () => {
    const profile = await createProfile('Doomed profile');
    const channelId = await createChannel({
      streamSelectionProfileId: profile.uuid,
    });
    const settingsRes = await app.inject({
      method: 'PUT',
      url: '/api/stream-selection-settings',
      payload: { defaultProfileId: profile.uuid },
    });
    expect(settingsRes.statusCode, settingsRes.body).toBe(200);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/stream-selection-profiles/${profile.uuid}`,
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(await getChannelProfileId(channelId)).toBeNull();
    expect(
      container.get<ISettingsDB>(KEYS.SettingsDB).streamSelectionSettings()
        .defaultProfileId,
    ).toBe(BuiltInStreamSelectionProfileId);
  });
});

describe('default profile setting', () => {
  test('rejects a profile that does not exist', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/stream-selection-settings',
      payload: { defaultProfileId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode).toBe(400);
  });

  test('marks the targeted profile as the default', async () => {
    const profile = await createProfile('New default');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/stream-selection-settings',
      payload: { defaultProfileId: profile.uuid },
    });
    expect(res.statusCode, res.body).toBe(200);

    const profiles = await listProfiles();
    expect(profiles.filter((p) => p.isDefault).map((p) => p.uuid)).toEqual([
      profile.uuid,
    ]);

    // Restore for other tests.
    await app.inject({
      method: 'PUT',
      url: '/api/stream-selection-settings',
      payload: { defaultProfileId: BuiltInStreamSelectionProfileId },
    });
  });
});

describe('source assignment', () => {
  test('custom shows accept, report, and clear a profile', async () => {
    const profile = await createProfile('Custom show profile');
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/custom-shows',
      payload: {
        name: 'Assigned show',
        programs: [],
        syncMediaSourceId: null,
        syncMediaSourceType: null,
        syncExternalPlaylistId: null,
        streamSelectionProfileId: profile.uuid,
      },
    });
    expect(createRes.statusCode, createRes.body).toBe(201);
    const show = createRes.json<{
      id: string;
      streamSelectionProfileId: string | null;
    }>();
    expect(show.streamSelectionProfileId).toBe(profile.uuid);

    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/custom-shows/${show.id}`,
      payload: { enableSync: false, streamSelectionProfileId: null },
    });
    expect(clearRes.statusCode, clearRes.body).toBe(200);
    expect(
      clearRes.json<{ streamSelectionProfileId: string | null }>()
        .streamSelectionProfileId,
    ).toBeNull();
  });

  test('custom shows reject a profile that does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/custom-shows',
      payload: {
        name: 'Bad show',
        programs: [],
        syncMediaSourceId: null,
        syncMediaSourceType: null,
        syncExternalPlaylistId: null,
        streamSelectionProfileId: NON_EXISTENT_UUID,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  test('filler lists accept and report a profile', async () => {
    const profile = await createProfile('Filler profile');
    const fillerId = v4();
    await container
      .get<DrizzleDBAccess>(KEYS.DrizzleDB)
      .insert(FillerShow)
      .values({ uuid: fillerId, name: 'Bumpers', createdAt: 0, updatedAt: 0 });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/filler-lists/${fillerId}`,
      payload: { streamSelectionProfileId: profile.uuid },
    });
    expect(res.statusCode, res.body).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/filler-lists/${fillerId}`,
    });
    expect(
      getRes.json<{ streamSelectionProfileId: string | null }>()
        .streamSelectionProfileId,
    ).toBe(profile.uuid);

    const listed = (await listProfiles()).find((p) => p.uuid === profile.uuid);
    expect(listed?.usage.fillerLists.map((f) => f.uuid)).toEqual([fillerId]);
  });

  test('filler lists reject a profile that does not exist', async () => {
    const fillerId = v4();
    await container
      .get<DrizzleDBAccess>(KEYS.DrizzleDB)
      .insert(FillerShow)
      .values({ uuid: fillerId, name: 'Promos', createdAt: 0, updatedAt: 0 });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/filler-lists/${fillerId}`,
      payload: { streamSelectionProfileId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('rule preview', () => {
  const rules = [
    {
      condition: 'true',
      audioAction: { type: 'default' },
      subtitleAction: { type: 'disable' },
    },
  ];

  test('rejects a request with no rules', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/stream-selection-profiles/preview',
      payload: { rules: [], programId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode, res.body).toBe(400);
  });

  test('returns 404 for an unknown program', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/stream-selection-profiles/preview',
      payload: { rules, programId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode, res.body).toBe(404);
    expect(res.json<{ message: string }>().message).toContain(
      NON_EXISTENT_UUID,
    );
  });
});
