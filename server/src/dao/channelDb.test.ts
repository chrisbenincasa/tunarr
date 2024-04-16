import { v4 } from 'uuid';
import fs from 'fs/promises';
import config from '../../mikro-orm.config.js';
import { ChannelDB } from './channelDb.js';
import { initOrm, withDb } from './dataSource.js';
import { setGlobalOptions } from '../globals.js';
import temp from 'temp';
import { join } from 'path';

beforeAll(async () => {
  temp.track();

  const database = await temp.mkdir();
  setGlobalOptions({
    database,
    force_migration: false,
    log_level: 'info',
  });

  await fs.mkdir(join(database, 'channel-lineups'));

  // this will create all the ORM services and cache them
  await initOrm({
    ...config,
    // no need for debug information, it would only pollute the logs
    debug: false,
    // we will use in-memory database, this way we can easily parallelize our tests
    dbName: ':memory:',
    // this will ensure the ORM discovers TS entities, with ts-node, ts-jest and vitest
    // it will be inferred automatically, but we are using vitest here
    // tsNode: true,
  });
});

test('test', async () => {
  await withDb(async () => {
    const channelDb = new ChannelDB();
    const id = await channelDb.saveChannel({
      id: v4(),
      number: 0,
      duration: 0,
      name: '',
      startTime: 0,
      icon: {
        path: '',
        duration: 0,
        width: 0,
        position: '',
      },
      disableFillerOverlay: false,
      groupTitle: '',
      guideMinimumDuration: 0,
      offline: {
        mode: 'pic',
        picture: undefined,
        soundtrack: undefined,
      },
      stealth: false,
      transcoding: {
        targetResolution: undefined,
        videoBitrate: undefined,
        videoBufferSize: undefined,
      },
    });

    const id2 = await channelDb.saveChannel({
      id: v4(),
      number: 1,
      duration: 0,
      name: '',
      startTime: 0,
      icon: {
        path: '',
        duration: 0,
        width: 0,
        position: '',
      },
      disableFillerOverlay: false,
      groupTitle: '',
      guideMinimumDuration: 0,
      offline: {
        mode: 'pic',
        picture: undefined,
        soundtrack: undefined,
      },
      stealth: false,
      transcoding: {
        targetResolution: undefined,
        videoBitrate: undefined,
        videoBufferSize: undefined,
      },
    });

    await channelDb.saveLineup(id2, {
      items: [
        {
          type: 'redirect',
          channel: id,
          durationMs: 60000,
        },
      ],
    });

    const lineupBefore = await channelDb.loadChannelAndLineup(id2);

    expect(lineupBefore?.lineup.items).toHaveLength(1);
    expect(lineupBefore?.lineup.items[0]).toMatchObject({
      type: 'redirect',
      channel: id,
      durationMs: 60000,
    });

    await channelDb.deleteChannel(id, true);

    const lineupAfter = await channelDb.loadChannelAndLineup(id2);

    expect(lineupAfter?.lineup.items).toHaveLength(1);
    expect(lineupAfter?.lineup.items[0]).toMatchObject({
      type: 'offline',
      durationMs: 60000,
    });
  });
});
