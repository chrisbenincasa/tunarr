import { fireEvent, renderWithProviders, screen } from '@/test/utils';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { ChannelCard } from './ChannelCard.tsx';
import { makeStoryChannel } from './channelStoryFixtures.ts';
import type { NowPlayingSummary } from './channelSummary.ts';

const playing = (artworkUrl: string): NowPlayingSummary => ({
  kind: 'content',
  title: artworkUrl,
  progress: 0.5,
  artworkUrl,
});

const Harness = () => {
  const [nowPlaying, setNowPlaying] = useState(playing('/art/first.jpg'));
  return (
    <>
      <button onClick={() => setNowPlaying(playing('/art/second.jpg'))}>
        next program
      </button>
      <ChannelCard
        channel={makeStoryChannel()}
        status={{ status: 'idle', connections: 0, sessions: 0 }}
        nowPlaying={nowPlaying}
      />
    </>
  );
};

const artwork = (container: HTMLElement, src: string) =>
  container.querySelector(`img[src="${src}"]`);

describe('ChannelCard', () => {
  test('shows artwork again for the next program after a load failure', async () => {
    const router = createRouter({
      routeTree: createRootRoute({ component: Harness }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    const { container, user } = renderWithProviders(
      <RouterProvider router={router} />,
    );
    await screen.findByRole('button', { name: 'next program' });
    const first = artwork(container, '/art/first.jpg');
    if (!first) {
      throw new Error('first artwork did not render');
    }

    fireEvent.error(first);
    expect(artwork(container, '/art/first.jpg')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'next program' }));
    expect(artwork(container, '/art/second.jpg')).not.toBeNull();
  });
});
