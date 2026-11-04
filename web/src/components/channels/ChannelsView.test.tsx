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
});
