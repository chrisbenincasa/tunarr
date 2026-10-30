import { Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MonoText } from './MonoText.tsx';

const meta = {
  title: 'Primitives/MonoText',
  component: MonoText,
  args: { children: '9:12 PM' },
} satisfies Meta<typeof MonoText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AlignedColumn: Story = {
  render: () => (
    <Stack gap={0.5}>
      {['1', '12', '105', '1024'].map((n) => (
        <Typography key={n}>
          <MonoText
            sx={{ display: 'inline-block', width: '4ch', textAlign: 'right' }}
          >
            {n}
          </MonoText>{' '}
          Channel
        </Typography>
      ))}
    </Stack>
  ),
};
