import { beforeAll, describe, mock, test } from 'bun:test';
import {
  initDatabaseAccess,
  syncMigrationTablesIfNecessary,
} from '../../db/DBAccess.ts';

beforeAll(async () => {
  initDatabaseAccess(':memory:');
  await syncMigrationTablesIfNecessary();
});

mock.module('./JellyfinApiClient.ts', () => {
  const JellyfinApiClient = mock(() => {});
  JellyfinApiClient.prototype;
  return { JellyfinApiClient };
});

describe('JellyfinItemFinder', () => {
  test('finds item', async () => {
    // TODO:
  });
});
