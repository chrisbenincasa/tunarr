import {
  getApiMediaSourcesByIdStatusQueryKey,
  getApiMediaSourcesQueryKey,
} from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
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

// The dialogs and add button fetch on their own. These tests cover only which
// source the page hands them.
vi.mock('@/components/settings/media_source/AddMediaSourceButton.tsx', () => ({
  AddMediaSourceButton: () => null,
}));
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
  paths: ['/media/movies'],
  pathReplacements: [],
  libraries: [],
};

const renderPage = () =>
  renderWithProviders(<MediaSourceSettingsPage />, {
    queryClient: seededQueryClient([
      [getApiMediaSourcesQueryKey(), [plexSource, localSource]],
      [
        getApiMediaSourcesByIdStatusQueryKey({ path: { id: 'plex-1' } }),
        { healthy: true },
      ],
      [
        getApiMediaSourcesByIdStatusQueryKey({ path: { id: 'local-1' } }),
        { healthy: false },
      ],
    ]),
  });

const card = (name: string) => within(screen.getByRole('article', { name }));

describe('MediaSourceSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('shows each source with its stored health status', () => {
    renderPage();
    expect(card('My Plex').getByText('Healthy')).toBeInTheDocument();
    expect(card('My Disk').getByText('Unreachable')).toBeInTheDocument();
  });

  test('refreshes the libraries of the clicked source', async () => {
    const { user } = renderPage();
    await user.click(
      screen.getByRole('button', { name: 'Refresh libraries of My Plex' }),
    );
    await waitFor(() =>
      expect(mocks.refresh).toHaveBeenCalledWith({ path: { id: 'plex-1' } }),
    );
  });

  test('opens the edit dialog that matches the source type', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Edit My Plex' }));
    expect(screen.getByText('Plex dialog for My Plex')).toBeInTheDocument();
    expect(screen.queryByText(/Local dialog/)).not.toBeInTheDocument();
  });

  test('opens the local dialog for a local source', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Edit My Disk' }));
    expect(screen.getByText('Local dialog for My Disk')).toBeInTheDocument();
  });

  test('opens the libraries dialog for the clicked source', async () => {
    const { user } = renderPage();
    await user.click(
      screen.getByRole('button', { name: 'Edit libraries of My Plex' }),
    );
    expect(screen.getByText('Libraries of My Plex')).toBeInTheDocument();
  });

  test('deletes the confirmed source through the API', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Delete My Disk' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({ path: { id: 'local-1' } }),
    );
  });
});
