import { getApiTasksQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
} from '@/test/utils';
import type { Task } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import TaskSettingsPage from './TaskSettingsPage.tsx';

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  postApiTasksByIdRunMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.run(vars)),
  }),
}));

const tasks: Task[] = [
  { id: 'cleanup', name: 'Cleanup', scheduledTasks: [] },
  { id: 'backup', name: 'Backup', scheduledTasks: [] },
];

const renderPage = () =>
  renderWithProviders(<TaskSettingsPage />, {
    queryClient: seededQueryClient([[getApiTasksQueryKey(), tasks]]),
  });

describe('TaskSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('renders the stored tasks', () => {
    renderPage();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  test('runs the chosen task in the background', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Run Cleanup' }));
    await waitFor(() =>
      expect(mocks.run).toHaveBeenCalledWith({
        path: { id: 'cleanup' },
        query: { background: true },
      }),
    );
  });
});
