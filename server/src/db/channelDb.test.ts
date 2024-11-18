import fs from 'fs/promises';
import { join } from 'path';
import temp from 'temp';
import { setGlobalOptions } from '../globals.ts';

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
