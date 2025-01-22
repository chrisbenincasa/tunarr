import { setGlobalOptions } from '@/globals.js';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import temp from 'temp';

beforeAll(async () => {
  temp.track();

  const database = await temp.mkdir();
  setGlobalOptions({
    databaseDirectory: database,
    force_migration: false,
    log_level: 'info',
  });

  await fs.mkdir(join(database, 'channel-lineups'));
});
