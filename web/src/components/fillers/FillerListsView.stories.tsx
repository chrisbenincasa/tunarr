import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FillerList } from '@tunarr/types';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryRouter } from '../ui/patterns/AppShell/storyComponents.tsx';
import { FillerListsView } from './FillerListsView.tsx';

const storyFillers: FillerList[] = [
  { id: 'filler-1', name: 'Station IDs', contentCount: 8 },
  { id: 'filler-2', name: '90s Commercials', contentCount: 412 },
  { id: 'filler-3', name: 'Music Video Bumpers', contentCount: 57 },
  { id: 'filler-4', name: 'Empty Placeholder', contentCount: 0 },
];

const longTextFiller: FillerList = {
  id: 'filler-long',
  name: 'Saturday Morning Cartoon Network Interstitials, Toonami Promos and Cereal Commercials 1995–2001',
  contentCount: 3120,
};

// Layout follows the toolbar's density unless a story forces one.
const meta = {
  title: 'Fillers/FillerListsView',
  component: FillerListsView,
  decorators: [
    (Story) => (
      <StoryRouter path="/library/fillers">
        <Story />
      </StoryRouter>
    ),
  ],
  args: {
    fillers: storyFillers,
    onOpenFiller: fn(),
    onAssignChannels: fn(),
    onDeleteFiller: fn(),
  },
} satisfies Meta<typeof FillerListsView>;

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
  args: { fillers: [longTextFiller, ...storyFillers] },
};

export const LongTextTable: Story = {
  args: { fillers: [longTextFiller, ...storyFillers], layout: 'table' },
};

export const Empty: Story = { args: { fillers: [] } };

export const EmptyTable: Story = { args: { fillers: [], layout: 'table' } };

export const CardActions: Story = {
  args: { layout: 'cards' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Assign Station IDs to channels' }),
    );
    await expect(args.onAssignChannels).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-1' }),
    );

    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete 90s Commercials' }),
    );
    const dialog = within(
      within(canvasElement.ownerDocument.body).getByRole('dialog'),
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await expect(args.onDeleteFiller).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-2' }),
    );
    await expect(args.onOpenFiller).not.toHaveBeenCalled();
  },
};
