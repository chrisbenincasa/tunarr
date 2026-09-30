import { expect, test } from '@playwright/test';
import { knownIssuesFor } from './knownIssues.ts';
import { watchPageHealth } from './pageHealth.ts';
import { generatedRoutePaths, readFixtureIds, ROUTES } from './routes.ts';

test('every generated route is mapped in the sweep', () => {
  const generated = new Set(generatedRoutePaths());
  const mapped = new Set(Object.keys(ROUTES));

  expect(
    [...generated].filter((p) => !mapped.has(p)),
    'Routes missing from e2e/tests/routes.ts',
  ).toEqual([]);
  expect(
    [...mapped].filter((p) => !generated.has(p)),
    'Stale entries in e2e/tests/routes.ts',
  ).toEqual([]);
});

for (const [routePath, target] of Object.entries(ROUTES)) {
  test(`route ${routePath}`, async ({ page }) => {
    if ('skip' in target) {
      test.skip(true, target.skip);
      return;
    }
    if ('broken' in target) {
      test.fail(true, target.broken);
    }
    const urlsFor = typeof target === 'function' ? target : target.urls;

    for (const url of urlsFor(readFixtureIds())) {
      await test.step(url, async () => {
        const health = watchPageHealth(page, knownIssuesFor(routePath));

        await page.goto(`/web${url}`);
        await health.settle();

        await expect(
          page.getByText('Looks like something went wrong.'),
        ).toHaveCount(0);
        await expect(page.getByText('Not found!')).toHaveCount(0);
        expect(health.problems).toEqual([]);

        if (health.warnings.length > 0) {
          test.info().annotations.push({
            type: 'console.warn',
            description: `${url}: ${health.warnings.join('\n')}`,
          });
        }
      });
    }
  });
}
