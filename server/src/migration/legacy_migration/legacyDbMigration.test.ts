import { file } from 'bun';
import { expect, test } from 'bun:test';
import { map } from 'lodash-es';
import { fileURLToPath } from 'node:url';
import tmp from 'tmp-promise';
import { afterAll, beforeAll, describe } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { container } from '../../container.ts';
import { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { setGlobalOptions } from '../../globals.ts';
import { KEYS } from '../../types/inject.ts';
import { typedProperty } from '../../types/path.ts';
import { LegacyChannelMigrator } from './LegacyChannelMigrator.ts';

// Make this a fixture
let dbResult: tmp.DirectoryResult;

beforeAll(async () => {
  dbResult = await tmp.dir({ unsafeCleanup: true });
  setGlobalOptions({
    database: dbResult.path,
    force_migration: false,
    log_level: 'debug',
    verbose: 0,
  });
  await bootstrapTunarr();
});

afterAll(async () => {
  await dbResult?.cleanup();
});

describe('Legacy DB Migration', () => {
  test('channel migration', async () => {
    const channelPath = fileURLToPath(
      import.meta.resolve('@/resources/test/legacy-migration/channels/1.json'),
    );

    const legacyFileContents = await file(channelPath).json();
    const durations = map(legacyFileContents['programs'], 'duration');

    const migrator = container.get<LegacyChannelMigrator>(
      LegacyChannelMigrator,
    );
    const { entity: channel } = await migrator.migrateChannel(channelPath);
    await migrator.migratePrograms(channelPath);

    const channelDB = container.get<IChannelDB>(KEYS.ChannelDB);
    const selectedChannel = await channelDB.getChannel(channel.uuid);
    expect(selectedChannel).not.toBeNull();
    const lineup = await channelDB.loadLineup(channel.uuid);
    expect(map(lineup.items, typedProperty('durationMs'))).toEqual(durations);
  });
});
