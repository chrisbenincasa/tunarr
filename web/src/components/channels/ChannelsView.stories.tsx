import { MoreVert } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryRouter } from '../ui/patterns/AppShell/storyComponents.tsx';
import { ChannelsView } from './ChannelsView.tsx';
import { channelsM3uUrl } from './channelSummary.ts';
import {
  longTextChannel,
  storyChannels,
  storyNowPlaying,
  storyTranscodeConfigs,
} from './channelStoryFixtures.ts';

// Layout follows the toolbar's density unless a story forces one.
const meta = {
  title: 'Channels/ChannelsView',
  component: ChannelsView,
  decorators: [
    (Story) => (
      <StoryRouter path="/channels">
        <Story />
      </StoryRouter>
    ),
  ],
  args: {
    channels: storyChannels,
    nowPlaying: storyNowPlaying,
    transcodeConfigs: storyTranscodeConfigs,
    onOpenChannel: fn(),
    onOpenSessions: fn(),
    m3uUrl: 'http://tunarr.test/api/channels.m3u',
    onDuplicateChannels: fn(),
    onAssignFillers: fn(),
    onDeleteChannels: fn(),
    renderMenu: (channel) => (
      <IconButton aria-label={`More actions for ${channel.name}`}>
        <MoreVert />
      </IconButton>
    ),
  },
} satisfies Meta<typeof ChannelsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FollowsDensity: Story = {};

// Every card, and every card's artwork, has the same height whether its
// now-playing box has a detail line, no detail line, or nothing at all.
const equalCardHeights: Story['play'] = async ({ canvasElement }) => {
  const cards = within(canvasElement).getAllByRole('article');
  const heights = (els: (Element | null)[]) =>
    new Set(els.map((el) => el?.getBoundingClientRect().height));
  await expect(heights(cards).size).toBe(1);
  await expect(heights(cards.map((c) => c.firstElementChild)).size).toBe(1);
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
  args: { channels: [longTextChannel, ...storyChannels] },
};

export const LongTextTable: Story = {
  args: { channels: [longTextChannel, ...storyChannels], layout: 'table' },
};

export const Empty: Story = { args: { channels: [] } };

export const EmptyTable: Story = { args: { channels: [], layout: 'table' } };

export const NowPlayingLoading: Story = { args: { nowPlaying: new Map() } };

const rowNames = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[2].textContent);

export const TableBulkActions: Story = {
  args: { layout: 'table' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('checkbox', {
        name: 'Select Saturday Morning Cartoons',
      }),
    );
    await userEvent.click(
      canvas.getByRole('checkbox', { name: 'Select Classic Sitcoms' }),
    );
    const bar = within(canvas.getByRole('region', { name: 'Selection' }));
    await expect(bar.getByText(/selected/)).toHaveTextContent('2 selected');

    await expect(bar.getByRole('link', { name: 'Export M3U' })).toHaveAttribute(
      'href',
      channelsM3uUrl('http://tunarr.test/api/channels.m3u', [1, 2]),
    );

    await userEvent.click(bar.getByRole('button', { name: 'Duplicate' }));
    await expect(args.onDuplicateChannels).toHaveBeenCalledWith([
      expect.objectContaining({ number: 1 }),
      expect.objectContaining({ number: 2 }),
    ]);
    await expect(args.onOpenChannel).not.toHaveBeenCalled();

    await userEvent.click(bar.getByRole('button', { name: 'Delete' }));
    const dialog = within(
      within(canvasElement.ownerDocument.body).getByRole('dialog'),
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await expect(args.onDeleteChannels).toHaveBeenCalledWith([
      expect.objectContaining({ number: 1 }),
      expect.objectContaining({ number: 2 }),
    ]);
    await expect(
      canvas.getByText('Select rows to act on several at once.'),
    ).toBeInTheDocument();
  },
};

export const TableKeyboard: Story = {
  args: { layout: 'table' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.keyboard('jjx');
    await expect(
      canvas.getByRole('checkbox', { name: 'Select Classic Sitcoms' }),
    ).toBeChecked();
    await userEvent.keyboard('k{Enter}');
    await expect(args.onOpenChannel).toHaveBeenCalledWith(
      expect.objectContaining({ number: 1 }),
    );
  },
};

export const StatusFilter: Story = {
  args: { layout: 'table' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Stealth' }));
    await expect(rowNames(canvasElement)).toEqual(['Music Videos']);

    await userEvent.click(canvas.getByRole('button', { name: 'Streaming' }));
    await expect(rowNames(canvasElement)).toEqual([
      'Saturday Morning Cartoons',
      'Sci-Fi Marathon',
    ]);
  },
};
