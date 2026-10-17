import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const navigateMock = vi.fn(() => Promise.resolve());
const updateMutateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('../hooks/media-sources/mediaSourceLibraryHooks.ts', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/media-sources/mediaSourceLibraryHooks.ts')
  >('../hooks/media-sources/mediaSourceLibraryHooks.ts');
  return {
    ...actual,
    useUpdateLibraryMutation: () => ({ mutate: updateMutateMock }),
  };
});

const { renderWithProviders, screen, waitFor, within } = await import(
  '../test/utils.tsx'
);
const { getApiMediaSourcesQueryKey } = await import(
  '../generated/@tanstack/react-query.gen.ts'
);
const { MediaSourceLibraryTable } = await import(
  './MediaSourceLibraryTable.tsx'
);

function remoteLib(
  id: string,
  name: string,
  enabled: boolean,
): MediaSourceLibrary {
  return {
    id,
    name,
    mediaType: 'movies',
    externalKey: id,
    type: 'plex',
    enabled,
    isLocked: false,
  };
}

const plexSource: MediaSourceSettings = {
  id: 'plex-1',
  name: 'My Plex',
  type: 'plex',
  uri: 'http://plex',
  accessToken: 'x',
  userId: null,
  username: null,
  sendPlayStatusUpdates: false,
  sendGuideUpdates: false,
  index: 0,
  pathReplacements: [],
  libraries: [
    remoteLib('lib-on', 'Movies On', true),
    remoteLib('lib-off', 'Movies Off', false),
  ],
};

const localSource: MediaSourceSettings = {
  id: 'local-1',
  name: 'My Local',
  type: 'local',
  mediaType: 'movies',
  paths: [],
  pathReplacements: [],
  libraries: [],
};

function renderTable() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  qc.setQueryData(getApiMediaSourcesQueryKey(), [plexSource, localSource]);
  return renderWithProviders(<MediaSourceLibraryTable />, { queryClient: qc });
}

describe('MediaSourceLibraryTable disabled libraries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('lists disabled libraries by default and marks them Not synced', async () => {
    renderTable();
    expect(await screen.findByText('Movies On')).toBeInTheDocument();
    expect(screen.getByText('Movies Off')).toBeInTheDocument();
    expect(screen.getByText('Not synced')).toBeInTheDocument();
  });

  test('local source shows All folders and no sync switch', async () => {
    renderTable();
    expect(await screen.findByText('All folders')).toBeInTheDocument();
    // 2 remote libraries => 2 switches; the local row contributes none.
    // (The "Show disabled libraries" toggle is a third checkbox, outside the table.)
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('checkbox')).toHaveLength(2);
  });

  test('the toggle hides disabled libraries', async () => {
    const { user } = renderTable();
    await screen.findByText('Movies Off');
    await user.click(
      screen.getByRole('checkbox', { name: /Show disabled libraries/i }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Movies Off')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Movies On')).toBeInTheDocument();
  });

  test('clicking a disabled row does not navigate', async () => {
    const { user } = renderTable();
    const cell = await screen.findByText('Movies Off');
    await user.click(cell);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  test('clicking an enabled row navigates to the library', async () => {
    const { user } = renderTable();
    const cell = await screen.findByText('Movies On');
    await user.click(cell);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
  });

  test('the inline switch enables a disabled library', async () => {
    const { user } = renderTable();
    await screen.findByText('Movies Off');
    const rows = screen.getAllByRole('row');
    const offRow = rows.find((r) => within(r).queryByText('Movies Off'));
    expect(offRow).toBeTruthy();
    await user.click(within(offRow!).getByRole('checkbox'));
    expect(updateMutateMock).toHaveBeenCalledWith({
      path: { id: 'plex-1', libraryId: 'lib-off' },
      body: { enabled: true },
    });
    // The switch must not also trigger row navigation.
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
