import { Button, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyHint } from './KeyHint.tsx';

const meta = {
  title: 'Primitives/KeyHint',
  component: KeyHint,
  args: { children: 'N' },
} satisfies Meta<typeof KeyHint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Chord: Story = { args: { children: '⌘K' } };

export const LongKey: Story = { args: { children: 'Enter' } };

export const InPrimaryButton: Story = {
  render: () => (
    <Button variant="contained" sx={{ gap: 1 }}>
      New Channel <KeyHint tone="onAccent">N</KeyHint>
    </Button>
  ),
};

export const HintRow: Story = {
  render: () => (
    <Typography
      component="div"
      color="text.secondary"
      sx={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 2 }}
    >
      <Stack direction="row" gap={0.5} alignItems="center">
        <KeyHint>J</KeyHint>/<KeyHint>K</KeyHint> move
      </Stack>
      <Stack direction="row" gap={0.5} alignItems="center">
        <KeyHint>X</KeyHint> select
      </Stack>
      <Stack direction="row" gap={0.5} alignItems="center">
        <KeyHint>Enter</KeyHint> open
      </Stack>
    </Typography>
  ),
};
