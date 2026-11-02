import { MoreVert } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryRouter } from '../ui/patterns/AppShell/storyComponents.tsx';
import { ChannelCard } from './ChannelCard.tsx';
import { channelStatus } from './channelSummary.ts';
import {
  longTextChannel,
  storyChannels,
  storyNowPlaying,
} from './channelStoryFixtures.ts';

const menu = (
  <IconButton aria-label="More actions">
    <MoreVert />
  </IconButton>
);

const cardFor = (index: number) => {
  const channel = storyChannels[index];
  return {
    channel,
    status: channelStatus(channel.sessions),
    nowPlaying: storyNowPlaying.get(channel.id),
    transcodeName: 'Default',
    menu,
  };
};

const meta = {
  title: 'Channels/ChannelCard',
  component: ChannelCard,
  decorators: [
    (Story) => (
      <StoryRouter path="/channels">
        <Box sx={{ width: 340 }}>
          <Story />
        </Box>
      </StoryRouter>
    ),
  ],
  args: cardFor(0),
} satisfies Meta<typeof ChannelCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const Idle: Story = { args: cardFor(1) };

export const OpenSessionNoViewers: Story = { args: cardFor(2) };

export const StealthOnFlex: Story = { args: cardFor(4) };

export const OnDemandRedirect: Story = { args: cardFor(5) };

export const NothingScheduled: Story = {
  args: { ...cardFor(1), nowPlaying: undefined },
};

export const LongText: Story = {
  args: {
    channel: longTextChannel,
    status: channelStatus(longTextChannel.sessions),
    nowPlaying: storyNowPlaying.get(longTextChannel.id),
    transcodeName: 'Intel QuickSync HEVC 2160p with tone mapping',
    menu,
  },
};
