import { getApiTasksQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  withinRow,
} from '@/test/utils';
import type { Task } from '@tunarr/types';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import TaskSettingsPage from './TaskSettingsPage.tsx';

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  postApiTasksByIdRunMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.run(vars)),
  }),
}));

const tasks: Task[] = [
  {
    id: 'scan-libraries',
    name: 'Scan Libraries',
    description: 'Scans every enabled library',
    scheduledTasks: [
      {
        running: false,
        lastExecutionEpoch: 1_700_000_000,
        nextExecutionEpoch: 1_700_090_000,
        args: {},
      },
      {
        running: false,
        lastExecutionEpoch: 1_700_050_000,
        nextExecutionEpoch: 1_700_060_000,
        args: {},
      },
    ],
  },
  { id: 'cleanup', name: 'Cleanup', scheduledTasks: [] },
];

const format = (epoch: number) => dayjs(epoch * 1000).format('llll');

const renderPage = () =>
  renderWithProviders(<TaskSettingsPage />, {
    queryClient: seededQueryClient([[getApiTasksQueryKey(), tasks]]),
  });

describe('TaskSettingsPage', () => {
  beforeAll(() => {
    dayjs.extend(localizedFormat);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows the latest last run and the earliest next run', () => {
    renderPage();
    const scan = withinRow('Scan Libraries');
    expect(scan.getByText('Scans every enabled library')).toBeInTheDocument();
    expect(scan.getByText(format(1_700_050_000))).toBeInTheDocument();
    expect(scan.getByText(format(1_700_060_000))).toBeInTheDocument();
  });

  test('shows dashes for a task with no description or schedule', () => {
    renderPage();
    const cells = withinRow('Cleanup').getAllByRole('cell');
    expect(cells.slice(1, 4).map((cell) => cell.textContent)).toEqual([
      '-',
      '-',
      '-',
    ]);
  });

  test('runs the task picked from its row menu in the background', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('Cleanup').getByRole('button', { name: 'Actions' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Run' }));
    await waitFor(() =>
      expect(mocks.run).toHaveBeenCalledWith({
        path: { id: 'cleanup' },
        query: { background: true },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
  });
});
