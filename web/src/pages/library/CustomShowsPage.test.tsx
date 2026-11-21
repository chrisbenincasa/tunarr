import { getApiCustomShowsQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import { navigateMock } from '@/test/routerMock.tsx';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
  withinRow,
} from '@/test/utils';
import type { CustomShow } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import CustomShowsPage from './CustomShowsPage.tsx';

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

vi.mock('@/components/Breadcrumbs.tsx', () => ({ default: () => null }));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  deleteCustomShowMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.remove(vars)),
  }),
}));

const show = (
  id: string,
  name: string,
  contentCount: number,
  syncMediaSourceId?: string,
): CustomShow => ({
  id,
  name,
  contentCount,
  schedulableContentCount: contentCount,
  totalDuration: 0,
  syncMediaSourceId,
  isSyncing: false,
});

const shows = [
  show('show-small', 'Shorts', 3),
  show('show-big', 'Marathon', 40, 'plex-1'),
];

const renderPage = () =>
  renderWithProviders(<CustomShowsPage />, {
    queryClient: seededQueryClient([[getApiCustomShowsQueryKey(), shows]]),
  });

const showNames = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('CustomShowsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('shows program counts and marks synced shows', () => {
    renderPage();
    expect(withinRow('Shorts').getByText('3')).toBeInTheDocument();
    expect(withinRow('Marathon').getByText('40')).toBeInTheDocument();
    expect(
      withinRow('Marathon').getByLabelText('Synced with external playlist'),
    ).toBeInTheDocument();
    expect(
      withinRow('Shorts').queryByLabelText('Synced with external playlist'),
    ).not.toBeInTheDocument();
  });

  test('opens the editor when a row is clicked', async () => {
    const { user } = renderPage();
    await user.click(screen.getByText('Shorts'));
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/library/playlists/$showId/edit',
      params: { showId: 'show-small' },
    });
  });

  test('links each row and the New button to the editor', () => {
    renderPage();
    expect(
      withinRow('Marathon').getByRole('link', { name: 'Edit' }),
    ).toHaveAttribute('href', '/library/playlists/show-big/edit');
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute(
      'href',
      '/library/playlists/new',
    );
  });

  test('deletes a show only after confirmation, without opening it', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('Marathon').getByRole('button', { name: 'Delete' }),
    );
    expect(navigateMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/Delete Playlist "Marathon"/),
    ).toBeVisible();
    expect(mocks.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({ path: { id: 'show-big' } }),
    );
  });

  test('filters shows by program count', async () => {
    const { user } = renderPage();
    expect(showNames()).toEqual(['Shorts', 'Marathon']);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Min # Programs' }),
      '10',
    );
    expect(showNames()).toEqual(['Marathon']);
  });
});
