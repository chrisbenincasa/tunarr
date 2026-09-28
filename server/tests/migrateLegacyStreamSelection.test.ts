import type { SaveableChannel } from '@tunarr/types';
import { BuiltInStreamSelectionProfileId } from '@tunarr/types/schemas';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { v4 } from 'uuid';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { container } from '../src/container.ts';
import type { ChannelDB } from '../src/db/ChannelDB.ts';
import type { ISettingsDB } from '../src/db/interfaces/ISettingsDB.ts';
import { Channel } from '../src/db/schema/Channel.ts';
import type { DrizzleDBAccess } from '../src/db/schema/index.ts';
import { StreamSelectionProfile } from '../src/db/schema/StreamSelectionProfile.ts';
import { ChannelSubtitlePreferences } from '../src/db/schema/SubtitlePreferences.ts';
import { TranscodeConfigDB } from '../src/db/TranscodeConfigDB.ts';
import {
  legacySubtitleAction,
  MigrateLegacyStreamSelection,
} from '../src/tasks/fixers/MigrateLegacyStreamSelection.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;
let drizzle: DrizzleDBAccess;
let settingsDB: ISettingsDB;
let transcodeConfigId: string;
let nextChannelNumber = 700;

async function createChannel(
  subtitlesEnabled: boolean,
  subtitlePrefs: { languageCode: string; priority: number }[] = [],
) {
  const channelDB = container.get<ChannelDB>(KEYS.ChannelDB);
  const { channel } = await channelDB.saveChannel({
    name: 'Legacy Channel',
    number: nextChannelNumber++,
    duration: 60000,
    groupTitle: 'test',
    guideMinimumDuration: 30000,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    id: v4(),
    startTime: 0,
    stealth: false,
    offline: { mode: 'pic' },
    streamMode: 'hls',
    transcodeConfigId,
    disableFillerOverlay: false,
    subtitlesEnabled,
  } satisfies SaveableChannel);

  for (const pref of subtitlePrefs) {
    await drizzle.insert(ChannelSubtitlePreferences).values({
      uuid: v4(),
      channelId: channel.uuid,
      languageCode: pref.languageCode,
      priority: pref.priority,
    });
  }
  return channel.uuid;
}

async function channelProfileName(channelId: string) {
  const [row] = await drizzle
    .select({ name: StreamSelectionProfile.name })
    .from(Channel)
    .leftJoin(
      StreamSelectionProfile,
      eq(Channel.streamSelectionProfileId, StreamSelectionProfile.uuid),
    )
    .where(eq(Channel.uuid, channelId));
  return row?.name ?? null;
}

function runFixer() {
  return new MigrateLegacyStreamSelection(drizzle, settingsDB).run();
}

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort());
  drizzle = container.get<DrizzleDBAccess>(KEYS.DrizzleDB);
  settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
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

beforeEach(async () => {
  await settingsDB.updateBaseSettings('migration', {
    hasMigratedLegacyStreamSelection: false,
  });
  await settingsDB.updateSettings('streamSelection', {
    defaultProfileId: BuiltInStreamSelectionProfileId,
  });
});

describe('MigrateLegacyStreamSelection', () => {
  test('deduplicates channels by subtitle configuration', async () => {
    const off = await createChannel(false);
    const engA = await createChannel(true, [
      { languageCode: 'eng', priority: 0 },
    ]);
    const engB = await createChannel(true, [
      { languageCode: 'eng', priority: 0 },
    ]);
    const spaEng = await createChannel(true, [
      { languageCode: 'eng', priority: 1 },
      { languageCode: 'spa', priority: 0 },
    ]);
    const noPrefs = await createChannel(true);

    await runFixer();

    expect(await channelProfileName(off)).toBeNull();
    expect(await channelProfileName(engA)).toBe('Migrated: eng subtitles');
    expect(await channelProfileName(engB)).toBe('Migrated: eng subtitles');
    expect(await channelProfileName(spaEng)).toBe(
      'Migrated: spa, eng subtitles',
    );
    expect(await channelProfileName(noPrefs)).toBe(
      'Migrated: default subtitles',
    );

    const [engProfileA] = await drizzle
      .select({ id: Channel.streamSelectionProfileId })
      .from(Channel)
      .where(eq(Channel.uuid, engA));
    const [engProfileB] = await drizzle
      .select({ id: Channel.streamSelectionProfileId })
      .from(Channel)
      .where(eq(Channel.uuid, engB));
    expect(engProfileA?.id).toBe(engProfileB?.id);
  });

  test('points the default at the migrated global audio preferences', async () => {
    await createChannel(false);

    await runFixer();

    const defaultId = settingsDB.streamSelectionSettings().defaultProfileId;
    expect(defaultId).not.toBe(BuiltInStreamSelectionProfileId);
    const [profile] = await drizzle
      .select()
      .from(StreamSelectionProfile)
      .where(eq(StreamSelectionProfile.uuid, defaultId));
    expect(profile?.name).toBe('Migrated Defaults');
    expect(profile?.rules).toEqual([
      {
        label: 'Migrated settings',
        condition: 'true',
        audioAction: { type: 'by_language', languages: ['eng'] },
        subtitleAction: { type: 'disable' },
      },
    ]);
  });

  test('runs only once', async () => {
    await runFixer();
    const count = async () =>
      (await drizzle.select().from(StreamSelectionProfile)).length;
    const before = await count();

    await createChannel(true, [{ languageCode: 'fre', priority: 0 }]);
    await runFixer();

    expect(await count()).toBe(before);
  });
});

describe('legacySubtitleAction', () => {
  test('drops "none" preferences and uses the top preference for filters', () => {
    expect(
      legacySubtitleAction([
        {
          languageCode: 'ger',
          priority: 0,
          filterType: 'none',
          allowImageBased: true,
          allowExternal: true,
        },
        {
          languageCode: 'eng',
          priority: 2,
          filterType: 'any',
          allowImageBased: true,
          allowExternal: true,
        },
        {
          languageCode: 'jpn',
          priority: 1,
          filterType: 'forced',
          allowImageBased: false,
          allowExternal: false,
        },
      ]),
    ).toEqual({
      type: 'by_language',
      languages: ['jpn', 'eng'],
      filterType: 'forced',
      allowImageBased: false,
      allowExternal: false,
      preferTextBased: false,
    });
  });
});
