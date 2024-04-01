import fs from 'node:fs';
import { build } from 'tsup';
import config from '../tsup.config.js';

await build(config);

fs.cpSync(
  'src/migrations/.snapshot-db.db.json',
  'dist/migrations/.snapshot-db.db.json',
);
