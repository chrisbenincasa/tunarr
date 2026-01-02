import tmp from 'tmp-promise';
import { test as baseTest } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { globalOptions, setGlobalOptions } from '../globals.ts';
import { DBAccess } from './DBAccess.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import { TagRepo } from './TagRepo.ts';

type Fixture = {
  db: string;
  tagRepo: TagRepo;
  drizzle: DrizzleDBAccess;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    setGlobalOptions({
      database: dbResult.path,
      log_level: 'info',
      verbose: 0,
    });
    await bootstrapTunarr(globalOptions(), ':memory:');
    await use(dbResult.path);
    await dbResult.cleanup();
  },
  drizzle: async ({ db: _ }, use) => {
    const conn = DBAccess.instance.getConnection(':memory:');
    await use(conn!.drizzle);
  },
  tagRepo: async ({ drizzle }, use) => {
    await use(new TagRepo(drizzle));
  },
});

describe('TagRepo', () => {
  test('upsertTag', async ({ tagRepo }) => {
    const tag1 = await tagRepo.upsertTag('tag1');
    const dupeTag = await tagRepo.upsertTag('tag1');
    expect(tag1).toBeDefined();
    expect(tag1!.uuid).toEqual(dupeTag?.uuid);

    const newTag = await tagRepo.upsertTag('tag2');
    expect(newTag?.uuid).not.toEqual(tag1!.uuid);
  });
});
