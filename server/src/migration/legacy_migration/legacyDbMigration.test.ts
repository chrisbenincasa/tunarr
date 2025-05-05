import { map } from 'lodash-es';
import path from 'node:path';
import tmp from 'tmp-promise';
import { afterAll, beforeAll, describe } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { container } from '../../container.ts';
import { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { setGlobalOptions } from '../../globals.ts';
import { KEYS } from '../../types/inject.ts';
import { typedProperty } from '../../types/path.ts';
import { LegacyChannelMigrator } from './LegacyChannelMigrator.ts';

// Make this a fixture
export let dbResult: tmp.DirectoryResult;

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
    const channelPath = path.resolve(
      import.meta.dirname,
      '../../resources/test/legacy-migration/channels/1.json',
    );
    const legacyFileContents = await import(
      '@/resources/test/legacy-migration/channels/1.json'
    );
    const durations = map(legacyFileContents['programs'], 'duration');

    const mediaSourceDB = container.get<MediaSourceDB>(MediaSourceDB);
    await mediaSourceDB.addMediaSource({
      accessToken: 'fake',
      name: 'dionysus',
      type: 'plex',
      uri: 'http://plex.fake.local',
      userId: null,
      username: null,
    });

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
