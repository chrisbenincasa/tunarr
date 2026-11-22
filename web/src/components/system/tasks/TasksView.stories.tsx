import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Task } from '@tunarr/types';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TasksView } from './TasksView.tsx';

// Fixed instants keep the screenshots stable.
const hour = 60 * 60;
const base = 1_798_000_000;

const scheduled = (
  lastOffset: number,
  nextOffset: number,
  running = false,
) => ({
  running,
  lastExecutionEpoch: base + lastOffset,
  nextExecutionEpoch: base + nextOffset,
  args: {},
});

const storyTasks: Task[] = [
  {
    id: 'ScanLibrariesTask',
    name: 'ScanLibrariesTask',
    description: 'Scans every enabled library for new and changed media.',
    scheduledTasks: [scheduled(-2 * hour, 4 * hour)],
  },
  {
    id: 'UpdateXmlTvTask',
    name: 'UpdateXmlTvTask',
    description: 'Rebuilds the XMLTV guide.',
    scheduledTasks: [scheduled(-hour, 0, true)],
  },
  {
    id: 'BackupTask',
    name: 'BackupTask',
    description: 'Writes a backup archive of the database and settings.',
    scheduledTasks: [scheduled(-20 * hour, 4 * hour)],
  },
  {
    id: 'SubtitleExtractorTask',
    name: 'SubtitleExtractorTask',
    scheduledTasks: [],
  },
];

const longTextTask: Task = {
  id: 'ReconcileProgramDurationsTask',
  name: 'ReconcileProgramDurationsTaskWithAnExtraLongNameThatKeepsGoing',
  description:
    'Compares every program duration against the media server and fixes lineups whose items drifted, which can take a long time on large libraries with many channels and custom shows.',
  scheduledTasks: [scheduled(-3 * hour, 21 * hour)],
};

// Layout follows the toolbar's density unless a story forces one.
const meta = {
  title: 'System/TasksView',
  component: TasksView,
  args: {
    tasks: storyTasks,
    onRunTask: fn(),
  },
} satisfies Meta<typeof TasksView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FollowsDensity: Story = {};

const equalCardHeights: Story['play'] = async ({ canvasElement }) => {
  const cards = within(canvasElement).getAllByRole('article');
  const heights = new Set(cards.map((c) => c.getBoundingClientRect().height));
  await expect(heights.size).toBe(1);
};

export const Cards: Story = {
  args: { layout: 'cards' },
  play: equalCardHeights,
};

export const CardsDense: Story = {
  args: { layout: 'cards' },
  globals: { density: 'dense' },
  play: equalCardHeights,
};

export const Table: Story = { args: { layout: 'table' } };

export const LongText: Story = {
  args: { tasks: [longTextTask, ...storyTasks] },
};

export const LongTextTable: Story = {
  args: { tasks: [longTextTask, ...storyTasks], layout: 'table' },
};

export const Empty: Story = { args: { tasks: [] } };

export const EmptyTable: Story = { args: { tasks: [], layout: 'table' } };

export const CardActions: Story = {
  args: { layout: 'cards' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Run BackupTask' }),
    );
    await expect(args.onRunTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'BackupTask' }),
    );
  },
};
