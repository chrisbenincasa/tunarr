import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { CommandPalette } from './CommandPalette.tsx';
import { filterPalette, type PaletteItem } from './paletteModel.ts';

const items: PaletteItem[] = [
  { id: 'p1', group: 'Pages', label: 'Guide', kind: 'Page' },
  { id: 'p2', group: 'Pages', label: 'Channels', kind: 'Page' },
  { id: 'p3', group: 'Pages', label: 'Filler Lists', kind: 'Library' },
  { id: 'p4', group: 'Pages', label: 'Smart Collections', kind: 'Library' },
  { id: 'p5', group: 'Pages', label: 'Logs', kind: 'System' },
  { id: 's1', group: 'Settings', label: 'General', kind: 'Settings' },
  { id: 's2', group: 'Settings', label: 'Sources', kind: 'Settings' },
  {
    id: 'c4',
    group: 'Channels',
    label: 'Sci-Fi Marathon',
    kind: 'Channel',
    number: '4',
  },
  {
    id: 'c12',
    group: 'Channels',
    label: 'Classic Sci-Fi Serials',
    kind: 'Channel',
    number: '12',
  },
  {
    id: 'c1234',
    group: 'Channels',
    label: 'Saturday Morning Science Fiction Cartoons and Weekday Reruns',
    kind: 'Channel',
    number: '1234',
  },
  {
    id: 'cs1',
    group: 'Custom Shows',
    label: 'Sci-Fi Shorts',
    kind: 'Custom show',
  },
  {
    id: 'sc1',
    group: 'Smart Collections',
    label: 'Sci-Fi Films',
    kind: 'Smart collection',
  },
  {
    id: 'sc2',
    group: 'Smart Collections',
    label: 'Sci-Fi Series, 1990s',
    kind: 'Smart collection',
  },
];

type PaletteStoryProps = {
  initialQuery: string;
  loading?: boolean;
  onSelect: (item: PaletteItem) => void;
  onSearchLibrary: (query: string) => void;
};

const PaletteStory = ({
  initialQuery,
  loading,
  onSelect,
  onSearchLibrary,
}: PaletteStoryProps) => {
  const [query, setQuery] = useState(initialQuery);
  return (
    <CommandPalette
      open
      onClose={() => {}}
      query={query}
      onQueryChange={setQuery}
      groups={loading ? [] : filterPalette(items, query)}
      loading={loading}
      onSelect={onSelect}
      onSearchLibrary={onSearchLibrary}
    />
  );
};

const meta = {
  title: 'Patterns/CommandPalette',
  component: PaletteStory,
  args: { initialQuery: 'sci', onSelect: fn(), onSearchLibrary: fn() },
} satisfies Meta<typeof PaletteStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Matches: Story = {};

export const MatchesDenseLight: Story = {
  globals: { density: 'dense', scheme: 'light' },
};

export const EmptyQuery: Story = { args: { initialQuery: '' } };

export const NoMatches: Story = { args: { initialQuery: 'zzzz' } };

export const LongQuery: Story = {
  args: {
    initialQuery:
      'saturday morning science fiction cartoons and weekday reruns',
  },
};

export const Loading: Story = { args: { initialQuery: 'sci', loading: true } };

export const EnterOpensFirstMatch: Story = {
  // The dialog renders in a portal, so this waits on document focus rather
  // than querying the story canvas.
  play: async ({ args, userEvent }) => {
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('role')).toBe('combobox'),
    );
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Classic Sci-Fi Serials' }),
    );
  },
};
