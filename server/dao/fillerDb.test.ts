import { serialize } from '@mikro-orm/core';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { test } from 'vitest';
import { setGlobalOptions } from '../globals.js';
import { getEm, withDb } from './dataSource.js';
import { Channel } from './entities/Channel.js';

dayjs.extend(duration);

test('Filler DB', async () => {
  setGlobalOptions({
    database: '.dizquetv',
    force_migration: false,
  });

  await withDb(async () => {
    const em = getEm();
    const channel = await em.find(Channel, {}, { populate: ['programs'] });
    channel.forEach((c) => {
      console.log(c.programs.$.count());
      serialize(c, { populate: ['programs'] });
    });
  });
});
