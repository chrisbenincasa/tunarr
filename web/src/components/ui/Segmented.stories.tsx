import { Computer, DarkMode, LightMode } from '@mui/icons-material';
import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Segmented, type SegmentedOption } from './Segmented.tsx';

type Status = 'all' | 'streaming' | 'stealth';

const statusOptions: SegmentedOption<Status>[] = [
  { value: 'all', label: 'All' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'stealth', label: 'Stealth' },
];

const StatefulSegmented = <T extends string>({
  options,
  initial,
  label,
  fullWidth,
}: {
  options: SegmentedOption<T>[];
  initial: T;
  label: string;
  fullWidth?: boolean;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <Segmented
      options={options}
      value={value}
      onChange={setValue}
      aria-label={label}
      fullWidth={fullWidth}
    />
  );
};

const meta = {
  title: 'Primitives/Segmented',
  component: StatefulSegmented<Status>,
  args: { options: statusOptions, initial: 'all', label: 'Status filter' },
} satisfies Meta<typeof StatefulSegmented<Status>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const streaming = canvas.getByRole('button', { name: 'Streaming' });
    await userEvent.click(streaming);
    await expect(streaming).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  },
};

export const WithIcons: Story = {
  render: () => (
    <StatefulSegmented
      label="Color mode"
      initial="system"
      options={[
        { value: 'light', label: 'Light', icon: <LightMode /> },
        { value: 'system', label: 'System', icon: <Computer /> },
        { value: 'dark', label: 'Dark', icon: <DarkMode /> },
      ]}
    />
  ),
};

export const DisabledOption: Story = {
  args: {
    options: [
      ...statusOptions.slice(0, 2),
      { value: 'stealth', label: 'Stealth', disabled: true },
    ],
  },
};

export const FullWidth: Story = {
  render: () => (
    <Box sx={{ width: 420 }}>
      <StatefulSegmented
        label="Density"
        initial="comfortable"
        fullWidth
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'dense', label: 'Dense' },
        ]}
      />
    </Box>
  ),
};

export const LongLabels: Story = {
  render: () => (
    <Box sx={{ width: 320 }}>
      <StatefulSegmented
        label="Playback order"
        initial="next"
        options={[
          { value: 'next', label: 'Next episode in order' },
          { value: 'shuffle', label: 'Shuffle across all seasons' },
        ]}
      />
    </Box>
  ),
};
