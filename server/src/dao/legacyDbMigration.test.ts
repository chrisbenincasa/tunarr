import { test, describe, beforeAll, afterAll } from 'vitest';
import { MikroORM, RequestContext } from '@mikro-orm/better-sqlite';
import dbConfig from '../../mikro-orm.config.js';
import {
  migrateChannel,
  migratePrograms,
} from './legacy_migration/channelMigrator.js';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Channel } from './entities/Channel.js';
import tmp from 'tmp-promise';
import fs from 'node:fs/promises';
import { inspect } from 'node:util';
import { migrateCustomShows } from './legacy_migration/customShowMigrator.js';
import { CustomShow } from './entities/CustomShow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resourcesPath = resolve(__dirname, '../resources/test');

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    ...dbConfig,
    debug: false,
    dbName: ':memory:',
  });
  await orm.schema.createSchema();
});

afterAll(async () => {
  await orm.close();
});

describe('Legacy DB Migration', () => {
  test('channel migration', async () => {
    const tmpDir = await tmp.dir();
    const channelPath = join(
      resourcesPath,
      'legacy-migration',
      'channels',
      '1.json',
    );

    await RequestContext.create(orm.em, async () => {
      await migrateChannel(channelPath);
      await migratePrograms(channelPath, tmpDir.path);
    });

    const allChannels = await orm.em.fork().repo(Channel).findAll();
    console.log(allChannels);

    const lineup = await fs.readFile(
      join(tmpDir.path, `${allChannels[0].uuid}.json`),
      'utf-8',
    );
    console.log(inspect(JSON.parse(lineup)));

    await fs.rm(tmpDir.path, { recursive: true, force: true });
  });

  test('custom show migration', async () => {
    const customShowPath = join(resourcesPath, 'legacy-migration');

    await RequestContext.create(orm.em, async () => {
      await migrateCustomShows(customShowPath, 'custom-shows');
    });

    const allCustomShows = await orm.em
      .fork()
      .repo(CustomShow)
      .findAll({ populate: ['*', 'content.*'] });

    console.log(inspect(allCustomShows));
  });
});
