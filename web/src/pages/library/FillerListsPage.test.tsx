import { getApiFillerListsQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
} from '@/test/utils';
import type { FillerList } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import FillerListsPage from './FillerListsPage.tsx';

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  deleteApiFillerListsByIdMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.remove(vars)),
  }),
}));

vi.mock('@/components/fillers/AssignFillerToChannelsDialog.tsx', () => ({
  AssignFillerToChannelsDialog: ({
    fillerName,
    onClose,
  }: {
    fillerName: string;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label={`Assign ${fillerName}`}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const fillers: FillerList[] = [
  { id: 'filler-ads', name: 'Retro Ads', contentCount: 120 },
];

const renderPage = () =>
  renderWithProviders(<FillerListsPage />, {
    queryClient: seededQueryClient([[getApiFillerListsQueryKey(), fillers]]),
  });

describe('FillerListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('renders the stored filler lists and links New to the editor', () => {
    renderPage();
    expect(
      screen.getByRole('article', { name: 'Retro Ads' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute(
      'href',
      '/library/fillers/new',
    );
  });

  test('opens the assign dialog for the chosen filler list', async () => {
    const { user } = renderPage();
    await user.click(
      screen.getByRole('button', { name: 'Assign Retro Ads to channels' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Assign Retro Ads' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByRole('dialog', { name: 'Assign Retro Ads' }),
    ).not.toBeInTheDocument();
  });

  test('deletes the confirmed filler list through the API', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Delete Retro Ads' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({ path: { id: 'filler-ads' } }),
    );
  });
});
