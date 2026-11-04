import { renderWithProviders, screen } from '@/test/utils';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { describe, expect, test } from 'vitest';
import { ChannelMenuButton } from './ChannelMenuButton.tsx';
import { makeStoryChannel } from './channelStoryFixtures.ts';

describe('ChannelMenuButton', () => {
  test('names the menu after the button that opens it', async () => {
    const router = createRouter({
      routeTree: createRootRoute({
        component: () => (
          <ChannelMenuButton channel={makeStoryChannel({ name: 'Cartoons' })} />
        ),
      }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    const { user } = renderWithProviders(<RouterProvider router={router} />);

    await user.click(
      await screen.findByRole('button', { name: 'More actions for Cartoons' }),
    );

    expect(
      screen.getByRole('menu', { name: 'More actions for Cartoons' }),
    ).toBeInTheDocument();
  });
});
