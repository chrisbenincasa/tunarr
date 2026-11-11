import { Box, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TrashView, type TrashItemType } from './TrashView.tsx';

// Stands in for LibraryProgramGrid, which needs search data.
const GridPlaceholder = () => (
  <Box
    sx={{
      height: 320,
      display: 'grid',
      placeItems: 'center',
      border: 1,
      borderStyle: 'dashed',
      borderColor: 'divider',
      borderRadius: 2,
    }}
  >
    <Typography color="text.secondary">Program grid</Typography>
  </Box>
);

const meta = {
  title: 'Library/TrashView',
  component: TrashView,
  decorators: [
    (Story) => (
      <Box sx={{ px: 2, py: 3 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    selectedTypes: [],
    onTypesChange: fn(),
    drain: { state: 'idle' },
    onEmptyTrash: fn(),
    onCancel: fn(),
    children: <GridPlaceholder />,
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof TrashView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Starting: Story = { args: { drain: { state: 'starting' } } };

export const Draining: Story = {
  args: { drain: { state: 'running', deleted: 142, total: 400 } },
};

export const Cancelling: Story = {
  args: { drain: { state: 'cancelling', deleted: 310, total: 400 } },
};

export const TypeFilter: Story = {
  render: function Render(args) {
    const [types, setTypes] = useState<TrashItemType[]>([]);
    return (
      <TrashView
        {...args}
        selectedTypes={types}
        onTypesChange={(next) => {
          args.onTypesChange(next);
          setTypes(next);
        }}
      />
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const movies = canvas.getByRole('button', { name: 'Movies' });
    const all = canvas.getByRole('button', { name: 'All' });
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(canvas.getByRole('button', { name: 'Tracks' }));
    await userEvent.click(movies);
    await expect(args.onTypesChange).toHaveBeenLastCalledWith([
      'movie',
      'track',
    ]);
    await expect(movies).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(all);
    await expect(args.onTypesChange).toHaveBeenLastCalledWith([]);
    await expect(movies).toHaveAttribute('aria-pressed', 'false');
  },
};

// Sets the real viewport so PageHeader stacks the way it does on a phone.
export const Phone: Story = {
  args: { drain: { state: 'running', deleted: 142, total: 400 } },
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
