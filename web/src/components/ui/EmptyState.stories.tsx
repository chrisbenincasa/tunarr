import { LiveTv, SearchOff } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState.tsx';

const meta = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  args: {
    icon: <LiveTv />,
    title: 'No channels yet',
    description:
      'Channels play your media on a schedule. Create one, then add programming to it.',
    actions: <Button variant="contained">New Channel</Button>,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoActions: Story = {
  args: {
    actions: (
      <>
        <Button variant="contained">New Channel</Button>
        <Button variant="outlined">Import from M3U</Button>
      </>
    ),
  },
};

export const NoResults: Story = {
  args: {
    icon: <SearchOff />,
    title: 'No matches',
    description: 'No filler lists match these filters.',
    actions: <Button variant="outlined">Clear filters</Button>,
  },
};

export const TitleOnly: Story = {
  args: {
    icon: undefined,
    description: undefined,
    actions: undefined,
    title: 'Trash is empty',
  },
};

export const LongText: Story = {
  render: (args) => (
    <Box sx={{ width: 360 }}>
      <EmptyState
        {...args}
        title="No programs in Saturday Morning Cartoons Marathon Weekend Edition"
        description="Add movies, episodes or music from any connected media source. Programs you add here appear in this custom show's lineup in the order you choose."
        actions={<Button variant="contained">Add Media</Button>}
      />
    </Box>
  ),
};
