import { getApiCustomShowsQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
} from '@/test/utils';
import type { CustomShow } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import CustomShowsPage from './CustomShowsPage.tsx';

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  deleteCustomShowMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.remove(vars)),
  }),
}));

const shows: CustomShow[] = [
  {
    id: 'show-big',
    name: 'Marathon',
    contentCount: 40,
    schedulableContentCount: 40,
    totalDuration: 0,
    isSyncing: false,
  },
];

const renderPage = () =>
  renderWithProviders(<CustomShowsPage />, {
    queryClient: seededQueryClient([[getApiCustomShowsQueryKey(), shows]]),
  });

describe('CustomShowsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('renders the stored shows and links New to the editor', () => {
    renderPage();
    expect(
      screen.getByRole('article', { name: 'Marathon' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute(
      'href',
      '/library/custom-shows/new',
    );
  });

  test('deletes the confirmed show through the API', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Delete Marathon' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({ path: { id: 'show-big' } }),
    );
  });
});
