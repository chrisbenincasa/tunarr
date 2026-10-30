import { Box, Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusPill } from './StatusPill.tsx';

const meta = {
  title: 'Primitives/StatusPill',
  component: StatusPill,
  args: { status: 'live', label: '3 watching' },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};
export const Idle: Story = { args: { status: 'idle', label: 'Idle' } };
export const Warning: Story = {
  args: { status: 'warning', label: 'Transcode fallback' },
};
export const Failed: Story = {
  args: { status: 'error', label: 'Stream failed' },
};

export const AllStates: Story = {
  render: () => (
    <Stack direction="row" gap={1} flexWrap="wrap">
      <StatusPill status="live" label="3 watching" />
      <StatusPill status="idle" label="Idle" />
      <StatusPill status="warning" label="Transcode fallback" />
      <StatusPill status="error" label="Stream failed" />
    </Stack>
  ),
};

export const LongLabelTruncates: Story = {
  render: () => (
    <Box sx={{ width: 160 }}>
      <StatusPill
        status="warning"
        label="Falling back to software transcoding on this channel"
      />
    </Box>
  ),
};
