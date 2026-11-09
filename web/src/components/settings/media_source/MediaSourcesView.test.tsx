import useStore from '@/store/index.ts';
import { renderWithProviders, screen, within, withinRow } from '@/test/utils';
import type { MediaSourceSettings } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../../ui/patterns/CollectionView/index.ts';
import type { MediaSourceHealth } from './MediaSourceHealthPill.tsx';
import { MediaSourcesView } from './MediaSourcesView.tsx';

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

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
  libraries: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Movies',
      mediaType: 'movies',
      externalKey: '1',
      type: 'plex',
      enabled: true,
      isLocked: false,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Shows',
      mediaType: 'shows',
      externalKey: '2',
      type: 'plex',
      enabled: false,
      isLocked: false,
    },
  ],
};

const localSource: MediaSourceSettings = {
  id: 'local-1',
  name: 'My Disk',
  type: 'local',
  mediaType: 'movies',
  paths: ['/media/movies', '/mnt/more-movies'],
  pathReplacements: [],
  libraries: [],
};

const sources = [plexSource, localSource];

const renderView = (
  layout: CollectionLayout,
  items = sources,
  health: Record<string, MediaSourceHealth> = {
    'plex-1': 'healthy',
    'local-1': 'unhealthy',
  },
) => {
  const callbacks = {
    onOpenSource: vi.fn(),
    onEditSource: vi.fn(),
    onRefreshLibraries: vi.fn(),
    onEditLibraries: vi.fn(),
    onDeleteSource: vi.fn(),
  };
  const result = renderWithProviders(
    <MediaSourcesView
      mediaSources={items}
      health={health}
      addButton={<button>Add</button>}
      layout={layout}
      {...callbacks}
    />,
  );
  return { ...result, ...callbacks };
};

beforeEach(() => {
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings = {};
  });
});

describe('MediaSourcesView table', () => {
  test('links remote sources and shows the first folder of local ones', () => {
    renderView('table');
    const plex = withinRow('My Plex');
    expect(plex.getByText('Plex')).toBeInTheDocument();
    expect(
      plex.getByRole('link', { name: 'http://plex.local:32400' }),
    ).toHaveAttribute('href', 'http://plex.local:32400');

    const local = withinRow('My Disk');
    expect(local.getByText('Local')).toBeInTheDocument();
    expect(local.getByText('/media/movies')).toBeInTheDocument();
    expect(local.getByText('+1 more')).toBeInTheDocument();
    expect(local.queryByRole('link')).not.toBeInTheDocument();
  });

  test('opens a source when its row is clicked', async () => {
    const { user, onOpenSource } = renderView('table');
    await user.click(screen.getByText('My Disk'));
    expect(onOpenSource).toHaveBeenCalledWith(localSource);
  });

  test('keeps row controls from opening the source', async () => {
    const { user, onOpenSource } = renderView('table');
    const plex = withinRow('My Plex');
    await user.click(plex.getByRole('button', { name: 'Edit Media Source' }));
    await user.click(plex.getByText('1 of 2 enabled'));
    await user.click(
      plex.getByRole('link', { name: 'http://plex.local:32400' }),
    );
    expect(onOpenSource).not.toHaveBeenCalled();
  });

  test('shows health and enabled libraries', () => {
    renderView('table');
    expect(withinRow('My Plex').getByText('Healthy')).toBeInTheDocument();
    expect(withinRow('My Plex').getByText('1 of 2 enabled')).toBeVisible();
    expect(withinRow('My Disk').getByText('Unreachable')).toBeInTheDocument();
  });

  test('shows a source with no health entry as checking', () => {
    renderView('table', sources, {});
    expect(withinRow('My Plex').getByText('Checking')).toBeInTheDocument();
  });

  test('offers library actions only for remote sources', () => {
    renderView('table');
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

  test('reports the row a row action belongs to', async () => {
    const { user, onEditSource, onRefreshLibraries, onEditLibraries } =
      renderView('table');
    const plex = withinRow('My Plex');
    await user.click(plex.getByRole('button', { name: 'Edit Media Source' }));
    await user.click(plex.getByRole('button', { name: 'Refresh Libraries' }));
    await user.click(plex.getByRole('button', { name: 'Edit Libraries' }));
    expect(onEditSource).toHaveBeenCalledWith(plexSource);
    expect(onRefreshLibraries).toHaveBeenCalledWith(plexSource);
    expect(onEditLibraries).toHaveBeenCalledWith(plexSource);
  });

  test('deletes a source only after confirmation', async () => {
    const { user, onDeleteSource } = renderView('table');
    await user.click(
      withinRow('My Disk').getByRole('button', { name: 'Delete' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Delete Media Source "My Disk"?'),
    ).toBeInTheDocument();
    expect(onDeleteSource).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onDeleteSource).toHaveBeenCalledWith(localSource);
  });
});

describe('MediaSourcesView cards', () => {
  test('shows one card per source with its type, health and location', () => {
    renderView('cards');
    expect(screen.getAllByRole('article')).toHaveLength(2);

    const plex = within(screen.getByRole('article', { name: 'My Plex' }));
    expect(plex.getByText('Plex')).toBeInTheDocument();
    expect(plex.getByText('Healthy')).toBeInTheDocument();
    expect(plex.getByText('1 of 2 enabled')).toBeInTheDocument();
    expect(
      plex.getByRole('link', { name: 'http://plex.local:32400' }),
    ).toBeInTheDocument();

    const local = within(screen.getByRole('article', { name: 'My Disk' }));
    expect(local.getByText('Unreachable')).toBeInTheDocument();
    expect(local.getByText('/media/movies')).toBeInTheDocument();
  });

  test('links the card title to the browse page', () => {
    renderView('cards');
    const plex = within(screen.getByRole('article', { name: 'My Plex' }));
    expect(plex.getByRole('link', { name: 'My Plex' })).toHaveAttribute(
      'href',
      '/media_sources/plex-1',
    );
  });

  test('runs each card action for its source', async () => {
    const { user, onEditSource, onRefreshLibraries, onEditLibraries } =
      renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Edit My Plex' }));
    await user.click(
      screen.getByRole('button', { name: 'Refresh libraries of My Plex' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Edit libraries of My Plex' }),
    );
    expect(onEditSource).toHaveBeenCalledWith(plexSource);
    expect(onRefreshLibraries).toHaveBeenCalledWith(plexSource);
    expect(onEditLibraries).toHaveBeenCalledWith(plexSource);
  });

  test('offers no library actions on a local card', () => {
    renderView('cards');
    expect(
      screen.queryByRole('button', { name: /libraries of My Disk/ }),
    ).not.toBeInTheDocument();
  });

  test('deletes from a card after confirmation', async () => {
    const { user, onDeleteSource } = renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Delete My Disk' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(onDeleteSource).toHaveBeenCalledWith(localSource);
  });

  test('counts sources in the header', () => {
    renderView('cards');
    expect(
      screen.getByText((_, el) => el?.textContent === '2 media sources'),
    ).toBeInTheDocument();
  });

  test('offers to add a source when there are none', () => {
    renderView('cards', []);
    expect(
      screen.getByText("You haven't added any media sources yet."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(2);
  });
});
