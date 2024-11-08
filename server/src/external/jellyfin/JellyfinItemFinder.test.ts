import {
  initDirectDbAccess,
  syncMigrationTablesIfNecessary,
} from '../../dao/direct/directDbAccess.ts';
import { ProgramDB } from '../../dao/programDB.ts';
import { JellyfinItemFinder } from './JellyfinItemFinder.ts';

beforeAll(async () => {
  initDirectDbAccess(':memory:');
  await syncMigrationTablesIfNecessary();
});

vi.mock(import('./JellyfinApiClient.ts'), () => {
  const JellyfinApiClient = vi.fn();
  JellyfinApiClient.prototype;
  return { JellyfinApiClient };
});

describe('JellyfinItemFinder', () => {
  test('finds item', async () => {
    const programDB = new ProgramDB();
    const finder = new JellyfinItemFinder(programDB);
    console.log(await programDB.getProgramById('Hello'));
  });
});
