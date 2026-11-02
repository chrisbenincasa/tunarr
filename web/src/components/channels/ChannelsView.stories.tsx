import { MoreVert } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StoryRouter } from '../ui/patterns/AppShell/storyComponents.tsx';
import { ChannelsView } from './ChannelsView.tsx';
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

export const Cards: Story = { args: { layout: 'cards' } };

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
