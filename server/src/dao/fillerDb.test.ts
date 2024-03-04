import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { test } from 'vitest';
import { setGlobalOptions } from '../globals.js';
import { getEm, withDb } from './dataSource.js';
import { FillerShow } from './entities/FillerShow.js';

dayjs.extend(duration);

test('Filler DB', async () => {
  setGlobalOptions({
    database: '.dizquetv',
    force_migration: false,
  });

  await withDb(async () => {
    const em = getEm();
    await em.removeAndFlush(
      em.getReference(FillerShow, 'd75ee652-e290-41b7-b93d-a45dcdb89b4c'),
    );
  });
});
