import { test } from 'vitest';
import { setGlobalOptions } from '../globals.js';
import { getEm, withDb } from './dataSource.js';
import { CustomShow } from './entities/CustomShow.js';

test('Filler DB', async () => {
  setGlobalOptions({
    database: '.dizquetv',
    force_migration: false,
  });

  await withDb(async () => {
    // const channelDb = new ChannelDB();
    // const channelCache = new ChannelCache(channelDb);
    // const fillerDb = new FillerDB(channelDb, channelCache);
    // const ids = await fillerDb.getAllFillerIds();
    // console.log(ids);

    // const fillers = await fillerDb.getAllFillers();
    // console.log(fillers);

    // console.log(await fillerDb.getFillerChannels(ids[0]));
    const x = getEm()
      .createQueryBuilder(CustomShow, 'cs')
      .select(['cs.uuid', 'cs.name', 'count(c.uuid) as count'])
      .leftJoin('cs.content', 'c')
      .groupBy('cs.uuid');
    console.log(x.getQuery());
    console.log(await x.get);
  });
});
