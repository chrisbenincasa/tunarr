import { renderWithProviders, screen } from '@/test/utils';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../ui/patterns/CollectionView/index.ts';
import { ChannelsView } from './ChannelsView.tsx';
import {
  makeStoryChannel,
  storyChannels,
  storyNowPlaying,
  storyTranscodeConfigs,
} from './channelStoryFixtures.ts';

const renderView = async (
  layout: CollectionLayout,
  channels = storyChannels,
) => {
  const rootRoute = createRootRoute({
    component: () => (
      <ChannelsView
        channels={channels}
        nowPlaying={storyNowPlaying}
        transcodeConfigs={storyTranscodeConfigs}
        onOpenChannel={() => {}}
        onOpenSessions={() => {}}
        renderMenu={() => null}
        layout={layout}
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Channels' });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChannelsView', () => {
  test('the table renders without console errors', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await renderView('table');

    expect(
      screen.getAllByRole('link', { name: 'Edit Channel Settings' }),
    ).not.toHaveLength(0);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('the cards show one page at the stored page size', async () => {
    const channels = Array.from({ length: 12 }, (_, i) =>
      makeStoryChannel({
        id: `channel-${i + 1}`,
        number: i + 1,
        name: `Channel ${i + 1}`,
      }),
    );
    await renderView('cards', channels);

    expect(screen.getAllByRole('article')).toHaveLength(10);
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
  });

  test('the header counts channels and streaming channels', async () => {
    await renderView('cards', [makeStoryChannel({ id: 'a', sessions: [] })]);

    expect(
      screen.getByText(
        (_, el) => el?.textContent === '1 channel · 0 streaming',
      ),
    ).toBeInTheDocument();
  });
});
