import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import { Channel } from '../../db/schema/Channel.ts';
import {
  defaultTranscodeConfig,
  TranscodeConfig,
} from '../../db/schema/TranscodeConfig.ts';
import { setGlobalOptionsUnchecked } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { EnsureTranscodeConfigIds } from './EnsureTranscodeConfigIds.ts';

type Fixture = {
  db: string;
  defaultTranscodeConfigId: string;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    await use(dbResult.path);
    const dbPath = `${dbResult.path}/db.db`;
    await DBAccess.instance.closeConnection(dbPath);
    await dbResult.cleanup();
  },
  defaultTranscodeConfigId: async ({ db: _ }, use) => {
    const config = await DBAccess.instance
      .db!.selectFrom('transcodeConfig')
      .select('uuid')
      .where('isDefault', '=', 1)
      .executeTakeFirstOrThrow();
    await use(config.uuid);
  },
});

function channelRow(
  overrides: Partial<typeof Channel.$inferInsert> = {},
): typeof Channel.$inferInsert {
  return {
    uuid: v4(),
    duration: 0,
    guideMinimumDuration: 30_000,
    icon: { path: '', width: 100, duration: 0, position: 'bottom-right' },
    name: 'Test Channel',
    number: 1,
    offline: { mode: 'pic' },
    startTime: 0,
    streamMode: 'hls',
    transcodeConfigId: 'placeholder',
    ...overrides,
  };
}

describe('EnsureTranscodeConfigIds', () => {
  test('reassigns channels with dangling transcode config ids to the default config', async ({
    db: _,
    defaultTranscodeConfigId,
  }) => {
    const drizzle = DBAccess.instance.drizzle!;
    const kysely = DBAccess.instance.db!;

    // Mirrors issue #1772: a channel saved (pre-validation) with the literal
    // string "default" as its transcode config ID, which references nothing.
    const danglingChannel = channelRow({
      number: 1,
      transcodeConfigId: 'default',
    });
    // A channel pointing at a config UUID that once existed but no longer does.
    const orphanedChannel = channelRow({
      number: 2,
      transcodeConfigId: v4(),
    });
    // A healthy channel that must not be touched.
    const validChannel = channelRow({
      number: 3,
      transcodeConfigId: defaultTranscodeConfigId,
    });

    await drizzle
      .insert(Channel)
      .values([danglingChannel, orphanedChannel, validChannel]);

    await new EnsureTranscodeConfigIds(kysely).run();

    const rows = await kysely
      .selectFrom('channel')
      .select(['uuid', 'transcodeConfigId'])
      .execute();
    const byUuid = Object.fromEntries(
      rows.map((r) => [r.uuid, r.transcodeConfigId]),
    );

    expect(byUuid[danglingChannel.uuid]).toBe(defaultTranscodeConfigId);
    expect(byUuid[orphanedChannel.uuid]).toBe(defaultTranscodeConfigId);
    expect(byUuid[validChannel.uuid]).toBe(defaultTranscodeConfigId);
  });

  test('leaves channels with valid non-default transcode configs untouched', async ({
    db: _,
  }) => {
    const drizzle = DBAccess.instance.drizzle!;
    const kysely = DBAccess.instance.db!;

    // Create a second, non-default transcode config.
    const secondConfig = {
      ...defaultTranscodeConfig(false),
      name: 'Secondary',
    };
    const secondConfigId = secondConfig.uuid;
    await drizzle.insert(TranscodeConfig).values(secondConfig);

    const channelOnSecondConfig = channelRow({
      number: 10,
      transcodeConfigId: secondConfigId,
    });
    await drizzle.insert(Channel).values([channelOnSecondConfig]);

    await new EnsureTranscodeConfigIds(kysely).run();

    const row = await kysely
      .selectFrom('channel')
      .select('transcodeConfigId')
      .where('uuid', '=', channelOnSecondConfig.uuid)
      .executeTakeFirstOrThrow();

    expect(row.transcodeConfigId).toBe(secondConfigId);
  });
});
