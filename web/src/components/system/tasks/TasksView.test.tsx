import useStore from '@/store/index.ts';
import { renderWithProviders, screen, within, withinRow } from '@/test/utils';
import type { Task } from '@tunarr/types';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../../ui/patterns/CollectionView/index.ts';
import { TasksView } from './TasksView.tsx';

const scanTask: Task = {
  id: 'scan-libraries',
  name: 'Scan Libraries',
  description: 'Scans every enabled library',
  scheduledTasks: [
    {
      running: false,
      lastExecutionEpoch: 1_700_000_000,
      nextExecutionEpoch: 1_700_090_000,
      args: {},
    },
    {
      running: false,
      lastExecutionEpoch: 1_700_050_000,
      nextExecutionEpoch: 1_700_060_000,
      args: {},
    },
  ],
};

const xmlTvTask: Task = {
  id: 'xmltv',
  name: 'Update XMLTV',
  scheduledTasks: [
    {
      running: true,
      lastExecutionEpoch: 1_700_000_000,
      nextExecutionEpoch: 1_700_003_600,
      args: {},
    },
  ],
};

const cleanupTask: Task = {
  id: 'cleanup',
  name: 'Cleanup',
  scheduledTasks: [],
};

const tasks = [scanTask, xmlTvTask, cleanupTask];

const renderView = (layout: CollectionLayout, items = tasks) => {
  const onRunTask = vi.fn();
  const result = renderWithProviders(
    <TasksView tasks={items} layout={layout} onRunTask={onRunTask} />,
  );
  return { ...result, onRunTask };
};

beforeAll(() => {
  dayjs.extend(localizedFormat);
});

beforeEach(() => {
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings = {};
  });
});

describe('TasksView table', () => {
  test('shows the latest last run and the earliest next run', () => {
    renderView('table');
    const scan = withinRow('Scan Libraries');
    expect(scan.getByText('Scans every enabled library')).toBeInTheDocument();
    expect(
      scan.getByText(dayjs(1_700_050_000 * 1000).format('llll')),
    ).toBeInTheDocument();
    expect(
      scan.getByText(dayjs(1_700_060_000 * 1000).format('llll')),
    ).toBeInTheDocument();
  });

  test('shows dashes for a task with no description or schedule', () => {
    renderView('table');
    const cells = withinRow('Cleanup').getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual(
      expect.arrayContaining(['-', 'Manual only']),
    );
    expect(cells.filter((cell) => cell.textContent === '-')).toHaveLength(3);
  });

  test('shows whether each task is running, scheduled or manual', () => {
    renderView('table');
    expect(withinRow('Scan Libraries').getByText('Scheduled')).toBeVisible();
    expect(withinRow('Update XMLTV').getByText('Running')).toBeVisible();
    expect(withinRow('Cleanup').getByText('Manual only')).toBeVisible();
  });

  test('runs the task in the clicked row', async () => {
    const { user, onRunTask } = renderView('table');
    await user.click(
      withinRow('Cleanup').getByRole('button', { name: 'Run now' }),
    );
    expect(onRunTask).toHaveBeenCalledWith(cleanupTask);
  });
});

describe('TasksView cards', () => {
  test('shows one card per task with its status and run times', () => {
    renderView('cards');
    expect(screen.getAllByRole('article')).toHaveLength(3);

    const scan = within(
      screen.getByRole('article', { name: 'Scan Libraries' }),
    );
    expect(scan.getByText('Scans every enabled library')).toBeInTheDocument();
    expect(scan.getByText('Scheduled')).toBeInTheDocument();
    expect(
      scan.getByText(dayjs(1_700_050_000 * 1000).format('lll')),
    ).toBeInTheDocument();
    expect(
      scan.getByText(dayjs(1_700_060_000 * 1000).format('lll')),
    ).toBeInTheDocument();
  });

  test('shows a manual task with no run times', () => {
    renderView('cards');
    const cleanup = within(screen.getByRole('article', { name: 'Cleanup' }));
    expect(cleanup.getByText('Manual only')).toBeInTheDocument();
    expect(cleanup.getAllByText('—')).toHaveLength(2);
  });

  test('runs a task from its card', async () => {
    const { user, onRunTask } = renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Run Update XMLTV' }));
    expect(onRunTask).toHaveBeenCalledWith(xmlTvTask);
  });

  test('explains an empty list', () => {
    renderView('cards', []);
    expect(screen.getByText('No tasks are registered.')).toBeInTheDocument();
  });
});
