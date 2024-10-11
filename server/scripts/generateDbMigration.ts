import path from 'path';
import tmp from 'tmp';
import dbConfig from '../mikro-orm.config.js';
import { initOrm } from '../src/dao/dataSource';

const tmpdir = tmp.dirSync({
  unsafeCleanup: true,
});

const dbName = path.join(tmpdir.name, 'db.db');

console.log(`using temporary database at ${dbName}`);

const orm = await initOrm({
  ...dbConfig,
  dbName,
});

const migrationResult = await orm.migrator.createMigration('./src/migrations');

console.log(`Succcesfully created migration ${migrationResult.fileName}`);

console.debug(migrationResult.diff);

await orm.close();

tmpdir.removeCallback();
