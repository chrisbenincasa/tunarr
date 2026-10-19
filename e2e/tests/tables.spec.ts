import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { SERVER_URL } from '../fixture/env.ts';
import type { FixtureIds } from '../fixture/seed.ts';
import { readFixtureIds } from './routes.ts';

// Table parity spec. Every table page must keep these behaviors while it
// moves from material-react-table to the DataTable wrapper, so the selectors
// rely only on roles and accessible names that both implementations share.

type TablePage = {
  url: (ids: FixtureIds) => string;

  // Text of a cell that is visible once the table has loaded.
  ready: string;

  // Whether sort, column visibility and page size survive a reload.
  persisted: boolean;

  // Set once the page uses DataTable, which adds steps MRT can't pass.
  ported?: boolean;

  // A column whose values sort as plain text.
  sortColumn: string;
  hideColumn?: string;
  filter: (page: Page) => Promise<void>;

  // Global search text that matches exactly one row.
  search?: { text: string; row: string };
  rowAction?: (page: Page, ids: FixtureIds) => Promise<void>;
};

type TableTarget = TablePage | { skip: string };

const table = (page: Page) => page.getByRole('table').first();

const bodyRows = (page: Page) =>
  table(page).getByRole('rowgroup').nth(1).getByRole('row');

const header = (page: Page, name: string) =>
  table(page).getByRole('columnheader', { name: new RegExp(`^${name}`) });

const showFilters = (page: Page) =>
  page.getByRole('button', { name: 'Show/Hide filters' }).click();

const openRowsPerPage = (page: Page) =>
  page.getByRole('combobox', { name: 'Rows per page' }).click();

const rowWith = (page: Page, text: string) =>
  bodyRows(page).filter({ has: page.getByRole('cell', { name: text }) });

const expectOnlyRow = async (page: Page, text: string) => {
  await expect(rowWith(page, text)).toHaveCount(1);
  await expect(bodyRows(page)).toHaveCount(1);
};

const columnValues = async (page: Page, column: string) => {
  const headers = await table(page).getByRole('columnheader').all();
  let index = -1;
  for (const [i, h] of headers.entries()) {
    if ((await h.textContent())?.trim().startsWith(column)) {
      index = i;
      break;
    }
  }
  expect(index, `column ${column}`).toBeGreaterThanOrEqual(0);
  const rows = await bodyRows(page).all();
  return Promise.all(
    rows.map(async (row) =>
      ((await row.getByRole('cell').nth(index).textContent()) ?? '').trim(),
    ),
  );
};

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

const expectSorted = async (
  page: Page,
  column: string,
  direction: 'asc' | 'desc',
) => {
  await expect
    .poll(async () => {
      const values = await columnValues(page, column);
      const sorted = [...values].sort(compareText);
      return direction === 'asc' ? sorted : sorted.reverse();
    })
    .toEqual(await columnValues(page, column));
};

const clickEditLink = async (page: Page, row: Locator, path: string) => {
  await row.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(new RegExp(`/web${path}$`));
};

const TABLES: Record<string, TableTarget> = {
  FillerLists: {
    url: () => '/library/fillers',
    ready: 'E2E Bumpers',
    persisted: true,
    ported: true,
    sortColumn: 'Name',
    hideColumn: '# Programs',
    filter: async (page) => {
      await showFilters(page);
      await page.getByRole('textbox', { name: 'Min' }).fill('2');
      await expectOnlyRow(page, 'E2E Bumpers');
    },
    search: { text: 'Bumpers', row: 'E2E Bumpers' },
    rowAction: async (page, ids) => {
      await clickEditLink(
        page,
        rowWith(page, 'E2E Bumpers'),
        `/library/fillers/${ids.fillerListId}/edit`,
      );
      await page.goBack();
      await rowWith(page, 'E2E Bumpers')
        .getByRole('cell', { name: 'E2E Bumpers' })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/library/fillers/${ids.fillerListId}/edit$`),
      );
    },
  },

  CustomShows: {
    url: () => '/library/custom-shows',
    ready: 'E2E Reruns',
    persisted: true,
    sortColumn: 'Name',
    hideColumn: '# Programs',
    filter: async (page) => {
      await showFilters(page);
      await page.getByRole('textbox', { name: 'Min' }).fill('2');
      await expectOnlyRow(page, 'E2E Reruns');
    },
    search: { text: 'Reruns', row: 'E2E Reruns' },
    rowAction: (page, ids) =>
      clickEditLink(
        page,
        rowWith(page, 'E2E Reruns'),
        `/library/custom-shows/${ids.customShowId}/edit`,
      ),
  },

  SmartCollections: {
    url: () => '/library/smart_collections',
    ready: 'E2E Movies Only',
    persisted: true,
    sortColumn: 'Name',
    filter: async (page) => {
      await showFilters(page);
      await page.getByRole('textbox', { name: 'Filter by Name' }).fill('zzz');
      await expect(rowWith(page, 'E2E Movies Only')).toHaveCount(0);
    },
    rowAction: async (page) => {
      await rowWith(page, 'E2E Movies Only')
        .getByRole('button', { name: 'Edit' })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },

  TranscodeConfigs: {
    url: () => '/settings/ffmpeg',
    ready: 'Default',
    persisted: true,
    sortColumn: 'Name',
    hideColumn: 'Resolution',
    filter: async (page) => {
      await showFilters(page);
      await page.getByRole('textbox', { name: 'Filter by Name' }).fill('zzz');
      await expect(rowWith(page, 'Default')).toHaveCount(0);
    },
    rowAction: (page, ids) =>
      clickEditLink(
        page,
        rowWith(page, 'Default'),
        `/settings/ffmpeg/${ids.transcodeConfigId}`,
      ),
  },

  MediaSourceSettings: {
    url: () => '/settings/sources',
    ready: 'E2E Shows',
    persisted: true,
    sortColumn: 'Name',
    hideColumn: 'URL',
    filter: async (page) => {
      await showFilters(page);
      await page.getByRole('textbox', { name: 'Filter by Name' }).fill('Shows');
      await expectOnlyRow(page, 'E2E Shows');
    },
    rowAction: async (page) => {
      await rowWith(page, 'E2E Shows')
        .getByRole('button', { name: 'Edit Media Source' })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },

  Channels: {
    url: () => '/channels',
    ready: 'E2E Episodes',
    persisted: true,
    sortColumn: 'Name',
    hideColumn: 'Duration',
    filter: async (page) => {
      await showFilters(page);
      await page
        .getByRole('textbox', { name: 'Filter by Name' })
        .fill('Episodes');
      await expectOnlyRow(page, 'E2E Episodes');
    },
    rowAction: async (page, ids) => {
      await rowWith(page, 'E2E Mixed')
        .getByRole('link', { name: 'Edit Channel Settings' })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/channels/${ids.channelIds[0]}/edit`),
      );
    },
  },

  Tasks: {
    url: () => '/system/tasks',
    ready: 'BackupTask',
    persisted: false,
    sortColumn: 'Name',
    hideColumn: 'Description',
    filter: async (page) => {
      await showFilters(page);
      await page
        .getByRole('textbox', { name: 'Filter by Name' })
        .fill('Backup');
      await expectOnlyRow(page, 'BackupTask');
    },
    rowAction: async (page) => {
      await rowWith(page, 'BackupTask').getByRole('button').first().click();
      await expect(page.getByRole('menuitem', { name: 'Run' })).toBeVisible();
    },
  },

  SystemLogs: {
    url: () => '/system/logs',
    ready: 'info',
    persisted: false,
    sortColumn: 'Timestamp',
    hideColumn: 'Component',
    filter: async (page) => {
      await showFilters(page);
      await page.getByRole('combobox', { name: 'Filter by Level' }).click();
      await page.getByRole('option', { name: 'error' }).click();
      await page.keyboard.press('Escape');
      await expect(
        bodyRows(page).getByRole('cell', { name: 'info', exact: true }),
      ).toHaveCount(0);
    },
  },

  MediaSourceLibrary: {
    skip: 'Ported in Phase 2. Add its entry in that PR, green on MRT first.',
  },
  ChannelSubtitlePreferences: {
    skip: 'Not persisted; channelSubtitlePreferences.spec.ts covers its edits.',
  },
  TimeSlots: { skip: 'Needs a time-slot schedule in the fixture (Phase 3).' },
  RandomSlots: {
    skip: 'Needs a random-slot schedule in the fixture (Phase 3).',
  },
};

for (const [name, target] of Object.entries(TABLES)) {
  test.describe(`table ${name}`, () => {
    if ('skip' in target) {
      test.skip(true, target.skip);
      return;
    }

    const open = async (page: Page) => {
      await page.goto(`/web${target.url(readFixtureIds())}`);
      await expect(
        table(page)
          .getByRole('cell', { name: target.ready, exact: true })
          .first(),
      ).toBeVisible();
    };

    const reload = async (page: Page) => {
      if (target.persisted) {
        await open(page);
      }
    };

    test('sorts a column', async ({ page }) => {
      await open(page);
      const column = target.sortColumn;
      const sortButton = header(page, column).getByRole('button', {
        name: new RegExp(`^Sort(ed)? by ${column}`),
      });
      await sortButton.click();
      await expect(sortButton).toHaveAccessibleName(
        `Sorted by ${column} ascending`,
      );
      await expectSorted(page, column, 'asc');
      await sortButton.click();
      await expect(sortButton).toHaveAccessibleName(
        `Sorted by ${column} descending`,
      );
      await expectSorted(page, column, 'desc');
      await reload(page);
      if (target.persisted) {
        await expectSorted(page, column, 'desc');
      }
    });

    const hideColumn = target.hideColumn;
    if (hideColumn !== undefined) {
      test('hides a column', async ({ page }) => {
        await open(page);
        await page.getByRole('button', { name: 'Show/Hide columns' }).click();
        await page
          .getByRole('checkbox', { name: `Toggle visibility ${hideColumn}` })
          .click();
        await page.keyboard.press('Escape');
        await expect(header(page, hideColumn)).toHaveCount(0);
        await reload(page);
        await expect(header(page, hideColumn)).toHaveCount(0);
      });
    }

    test('changes the page size', async ({ page }) => {
      await open(page);
      await openRowsPerPage(page);
      await page.getByRole('option', { name: '5', exact: true }).click();
      const rowsPerPage = page.getByRole('combobox', { name: 'Rows per page' });
      await expect(rowsPerPage).toHaveText('5');
      await expect.poll(() => bodyRows(page).count()).toBeLessThanOrEqual(5);
      await reload(page);
      await expect(rowsPerPage).toHaveText('5');
    });

    test('applies a filter', async ({ page }) => {
      await open(page);
      await target.filter(page);
    });

    const search = target.search;
    if (search !== undefined) {
      test('searches the table', async ({ page }) => {
        await open(page);
        await page.getByRole('button', { name: 'Show/Hide search' }).click();
        await page
          .getByRole('textbox', { name: 'Search', exact: true })
          .fill(search.text);
        await expectOnlyRow(page, search.row);
      });
    }

    if (target.ported) {
      test('counts and clears filters', async ({ page }) => {
        await open(page);
        const rowsBefore = await bodyRows(page).count();
        await target.filter(page);
        await expect(
          page.getByRole('button', { name: 'Show/Hide filters (1 active)' }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Clear filters' }).click();
        await expect(bodyRows(page)).toHaveCount(rowsBefore);
        await expect(
          page.getByRole('button', { name: 'Clear filters' }),
        ).toHaveCount(0);
      });
    }

    const rowAction = target.rowAction;
    if (rowAction !== undefined) {
      test('runs a row action', async ({ page }) => {
        await open(page);
        await rowAction(page, readFixtureIds());
      });
    }
  });
}

// Captured from the material-react-table build after hiding "# Programs",
// choosing 5 rows per page and sorting by name. The extra mrt-row-actions key
// is the kind of display-column id old builds could store.
const savedByMrt = {
  state: {
    theme: {
      showWelcome: true,
      guideDuration: 7200000,
      themePreference: 'system',
      programmingSelectorView: 'grid',
      density: 'comfortable',
    },
    settings: {
      backendUri: SERVER_URL,
      ui: {
        channelTablePagination: { pageIndex: 0, pageSize: 10 },
        channelTableColumnModel: { onDemand: false },
        i18n: { locale: 'en', timeFormat: 'auto' },
        tableSettings: {
          FillerLists: {
            sortState: [{ id: 'name', desc: true }],
            columnModel: { contentCount: false, 'mrt-row-actions': true },
            pagination: { pageIndex: 0, pageSize: 5 },
          },
        },
        showAdvancedSettings: false,
      },
    },
  },
  version: 0,
};

test('table settings saved by the MRT build still load', async ({ page }) => {
  await page.addInitScript((saved) => {
    localStorage.setItem('tunarr', saved);
  }, JSON.stringify(savedByMrt));
  await page.goto('/web/library/fillers');
  await expect(
    table(page).getByRole('cell', { name: 'E2E Bumpers', exact: true }),
  ).toBeVisible();

  await expect(header(page, '# Programs')).toHaveCount(0);
  await expect(
    page.getByRole('combobox', { name: 'Rows per page' }),
  ).toHaveText('5');
  await expectSorted(page, 'Name', 'desc');

  const stored = await page.evaluate(() => localStorage.getItem('tunarr'));
  expect(stored).toContain('"pageSize":5');
});
