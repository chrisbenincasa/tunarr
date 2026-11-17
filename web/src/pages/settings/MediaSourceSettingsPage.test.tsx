import { getApiMediaSourcesQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
  withinRow,
} from '@/test/utils';
import type { MediaSourceSettings } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import MediaSourceSettingsPage from './MediaSourceSettingsPage.tsx';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), remove: vi.fn() }));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  postApiMediaSourcesByIdLibrariesRefreshMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.refresh(vars)),
  }),
  deleteApiMediaSourcesByIdMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.remove(vars)),
  }),
}));

// The dialogs, health check and add button fetch on their own. These tests
// cover only which source the page hands them.
vi.mock('@/components/settings/media_source/AddMediaSourceButton.tsx', () => ({
  AddMediaSourceButton: () => null,
}));
vi.mock(
  '@/components/settings/media_source/MediaSourceHealthyTableCell.tsx',
  () => ({ MediaSourceHealthyTableCell: () => null }),
);
vi.mock('@/components/settings/media_source/PlexServerEditDialog.tsx', () => ({
  PlexServerEditDialog: ({ server }: { server: MediaSourceSettings }) => (
    <div>Plex dialog for {server.name}</div>
  ),
}));
vi.mock(
  '@/components/settings/media_source/JelllyfinServerEditDialog.tsx',
  () => ({ JellyfinServerEditDialog: () => null }),
);
vi.mock('@/components/settings/media_source/EmbyServerEditDialog.tsx', () => ({
  EmbyServerEditDialog: () => null,
}));
vi.mock('@/components/settings/media_source/LocalMediaEditDialog.tsx', () => ({
  LocalMediaEditDialog: ({ source }: { source: MediaSourceSettings }) => (
    <div>Local dialog for {source.name}</div>
  ),
}));
vi.mock(
  '@/components/settings/media_source/EditMediaSourceLibrariesDialog.tsx',
  () => ({
    EditMediaSourceLibrariesDialog: ({
      open,
      mediaSource,
    }: {
      open: boolean;
      mediaSource: MediaSourceSettings | null;
    }) => (open ? <div>Libraries of {mediaSource?.name}</div> : null),
  }),
);

const plexSource: MediaSourceSettings = {
  id: 'plex-1',
  name: 'My Plex',
  type: 'plex',
  uri: 'http://plex.local:32400',
  accessToken: 'x',
  userId: null,
  username: null,
  sendPlayStatusUpdates: false,
  sendGuideUpdates: false,
  index: 0,
  pathReplacements: [],
  libraries: [],
};

const localSource: MediaSourceSettings = {
  id: 'local-1',
  name: 'My Disk',
  type: 'local',
  mediaType: 'movies',
  paths: [],
  pathReplacements: [],
  libraries: [],
};

const renderPage = () =>
  renderWithProviders(<MediaSourceSettingsPage />, {
    queryClient: seededQueryClient([
      [getApiMediaSourcesQueryKey(), [plexSource, localSource]],
    ]),
  });

describe('MediaSourceSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('links remote sources and shows a dash for local ones', () => {
    renderPage();
    const plex = withinRow('My Plex');
    expect(plex.getByText('Plex')).toBeInTheDocument();
    expect(
      plex.getByRole('link', { name: 'http://plex.local:32400' }),
    ).toHaveAttribute('href', 'http://plex.local:32400');

    const local = withinRow('My Disk');
    expect(local.getByText('Local')).toBeInTheDocument();
    const [, , urlCell] = local.getAllByRole('cell');
    expect(urlCell).toHaveTextContent(/^-$/);
    expect(local.queryByRole('link')).not.toBeInTheDocument();
  });

  test('offers library actions only for remote sources', () => {
    renderPage();
    const plex = withinRow('My Plex');
    expect(
      plex.getByRole('button', { name: 'Refresh Libraries' }),
    ).toBeVisible();
    expect(plex.getByRole('button', { name: 'Edit Libraries' })).toBeVisible();

    const local = withinRow('My Disk');
    expect(
      local.queryByRole('button', { name: 'Refresh Libraries' }),
    ).not.toBeInTheDocument();
    expect(
      local.queryByRole('button', { name: 'Edit Libraries' }),
    ).not.toBeInTheDocument();
  });

  test('refreshes the libraries of the clicked source', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('My Plex').getByRole('button', { name: 'Refresh Libraries' }),
    );
    await waitFor(() =>
      expect(mocks.refresh).toHaveBeenCalledWith({ path: { id: 'plex-1' } }),
    );
  });

  test('opens the edit dialog that matches the source type', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('My Plex').getByRole('button', { name: 'Edit Media Source' }),
    );
    expect(screen.getByText('Plex dialog for My Plex')).toBeInTheDocument();
    expect(screen.queryByText(/Local dialog/)).not.toBeInTheDocument();
  });

  test('opens the local dialog for a local source', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('My Disk').getByRole('button', { name: 'Edit Media Source' }),
    );
    expect(screen.getByText('Local dialog for My Disk')).toBeInTheDocument();
  });

  test('opens the libraries dialog for the clicked source', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('My Plex').getByRole('button', { name: 'Edit Libraries' }),
    );
    expect(screen.getByText('Libraries of My Plex')).toBeInTheDocument();
  });

  test('deletes a source only after confirmation', async () => {
    const { user } = renderPage();
    await user.click(
      withinRow('My Disk').getByRole('button', { name: 'Delete' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Delete Media Source "My Disk"?'),
    ).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({ path: { id: 'local-1' } }),
    );
  });
});
