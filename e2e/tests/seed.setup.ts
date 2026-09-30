import { test } from '@playwright/test';
import { seed, writeFixtureIds } from '../fixture/seed.ts';

test('seed fixture database', async () => {
  writeFixtureIds(await seed());
});
