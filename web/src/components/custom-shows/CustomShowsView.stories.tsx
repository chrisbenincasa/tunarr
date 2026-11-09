import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CustomShow } from '@tunarr/types';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryRouter } from '../ui/patterns/AppShell/storyComponents.tsx';
import { CustomShowsView } from './CustomShowsView.tsx';

const hour = 60 * 60 * 1000;

const makeShow = (overrides: Partial<CustomShow>): CustomShow => ({
  id: 'show-1',
  name: 'Christmas Specials',
  contentCount: 24,
  schedulableContentCount: 24,
  totalDuration: 11 * hour,
  isSyncing: false,
  ...overrides,
});

const storyShows: CustomShow[] = [
  makeShow({}),
  makeShow({
    id: 'show-2',
    name: 'Star Trek: Best of Both Worlds',
    contentCount: 2,
    schedulableContentCount: 2,
    totalDuration: 1.5 * hour,
  }),
  makeShow({
    id: 'show-3',
    name: 'Saturday Morning Mix',
    contentCount: 186,
    schedulableContentCount: 186,
    totalDuration: 74 * hour,
    syncMediaSourceId: 'plex-1',
    syncMediaSourceType: 'plex',
  }),
  makeShow({
    id: 'show-4',
    name: 'Movie Night',
    contentCount: 12,
    schedulableContentCount: 12,
    totalDuration: 23 * hour,
    syncMediaSourceId: 'plex-1',
    syncMediaSourceType: 'plex',
    isSyncing: true,
  }),
];

const longTextShow = makeShow({
  id: 'show-long',
  name: 'The Complete Unabridged Director’s Cut Anthology of Late Night Public Access Television, 1987–1994',
  contentCount: 1204,
  schedulableContentCount: 1204,
  totalDuration: 900 * hour,
});

// Layout follows the toolbar's density unless a story forces one.
const meta = {
  title: 'Playlists/CustomShowsView',
  component: CustomShowsView,
  decorators: [
    (Story) => (
      <StoryRouter path="/library/custom-shows">
        <Story />
      </StoryRouter>
    ),
  ],
  args: {
    shows: storyShows,
    onOpenShow: fn(),
    onDeleteShow: fn(),
  },
} satisfies Meta<typeof CustomShowsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FollowsDensity: Story = {};

const equalCardHeights: Story['play'] = async ({ canvasElement }) => {
  const cards = within(canvasElement).getAllByRole('article');
  const heights = new Set(cards.map((c) => c.getBoundingClientRect().height));
  await expect(heights.size).toBe(1);
};

export const Cards: Story = {
  args: { layout: 'cards' },
  play: equalCardHeights,
};

export const CardsDense: Story = {
  args: { layout: 'cards' },
  globals: { density: 'dense' },
  play: equalCardHeights,
};

export const Table: Story = { args: { layout: 'table' } };

export const LongText: Story = {
  args: { shows: [longTextShow, ...storyShows] },
};

export const LongTextTable: Story = {
  args: { shows: [longTextShow, ...storyShows], layout: 'table' },
};

export const Empty: Story = { args: { shows: [] } };

export const EmptyTable: Story = { args: { shows: [], layout: 'table' } };

export const CardDelete: Story = {
  args: { layout: 'cards' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete Movie Night' }),
    );
    const dialog = within(
      within(canvasElement.ownerDocument.body).getByRole('dialog'),
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await expect(args.onDeleteShow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'show-4' }),
    );
    await expect(args.onOpenShow).not.toHaveBeenCalled();
  },
};
