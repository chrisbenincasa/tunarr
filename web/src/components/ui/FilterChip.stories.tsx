import { Movie, Tv } from '@mui/icons-material';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { FilterChip } from './FilterChip.tsx';

const meta = {
  title: 'Primitives/FilterChip',
  component: FilterChip,
  args: { label: 'Movies', selected: false, onClick: fn() },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};
export const Selected: Story = { args: { selected: true } };
export const WithIcon: Story = {
  args: { icon: <Movie />, selected: true },
};

const options = ['Movies', 'Episodes', 'Music videos', 'Tracks'];

const MultiSelectRow = () => {
  const [selected, setSelected] = useState<string[]>(['Episodes']);
  const toggle = (option: string) =>
    setSelected((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option],
    );

  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      <FilterChip
        label="All"
        selected={selected.length === 0}
        onClick={() => setSelected([])}
      />
      {options.map((option) => (
        <FilterChip
          key={option}
          label={option}
          icon={option === 'Episodes' ? <Tv /> : undefined}
          selected={selected.includes(option)}
          onClick={() => toggle(option)}
        />
      ))}
    </Stack>
  );
};

export const MultiSelect: Story = {
  render: () => <MultiSelectRow />,
};
