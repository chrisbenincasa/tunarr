import useStore from '@/store/index.ts';
import { renderWithProviders, screen, within, withinRow } from '@/test/utils';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../../ui/patterns/CollectionView/index.ts';
import { SystemLogsView, type SystemLogsViewProps } from './SystemLogsView.tsx';
import type { LogLine } from './logLine.ts';

const time = 1_700_000_000_000;

const line = (
  id: number,
  level: LogLine['level'],
  msg: string,
  extra: Partial<LogLine> = {},
): LogLine => ({
  id,
  time: time + id * 1000,
  level,
  caller: 'Scanner',
  msg,
  context: {},
  raw: `{"msg":"${msg}"}`,
  ...extra,
});

const scanFailed = line(3, 'error', 'Scan failed', {
  caller: 'ScanLibrariesTask',
  err: {
    type: 'AxiosError',
    message: 'connect ECONNREFUSED 192.168.1.20:32400',
    stack: '    at PlexApiClient.doRequest (PlexApiClient.ts:212:15)',
  },
  context: { task: 'ScanLibrariesTask', library: 'Movies' },
});

const lines = [
  scanFailed,
  line(2, 'warn', 'Low disk'),
  line(1, 'info', 'Server started'),
];

const renderView = (
  layout: CollectionLayout,
  props: Partial<SystemLogsViewProps> = {},
) => {
  const onTogglePause = vi.fn();
  const view = (overrides: Partial<SystemLogsViewProps> = {}) => (
    <SystemLogsView
      lines={lines}
      paused={false}
      newWhilePaused={0}
      onTogglePause={onTogglePause}
      downloadUrl={(limit) => (limit ? `/logs?lineLimit=${limit}` : '/logs')}
      layout={layout}
      {...props}
      {...overrides}
    />
  );
  const result = renderWithProviders(view());
  return {
    ...result,
    onTogglePause,
    rerenderWith: (overrides: Partial<SystemLogsViewProps>) =>
      result.rerender(view(overrides)),
  };
};

const messages = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).queryAllByRole('cell').at(-1)?.textContent);

beforeAll(() => {
  dayjs.extend(localizedFormat);
});

beforeEach(() => {
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings = {};
  });
});

describe('SystemLogsView table', () => {
  test('shows each line newest first', () => {
    renderView('table');
    expect(messages()).toEqual(['Scan failed', 'Low disk', 'Server started']);
    const row = withinRow('Scan failed');
    expect(
      row.getByText(dayjs(scanFailed.time).format('L LTS')),
    ).toBeInTheDocument();
    expect(row.getByText('error')).toBeInTheDocument();
    expect(row.getByText('ScanLibrariesTask')).toBeInTheDocument();
  });

  test('opens a row to show its error and context', async () => {
    const { user } = renderView('table');
    await user.click(screen.getByText('Scan failed'));

    expect(
      screen.getByText('AxiosError: connect ECONNREFUSED 192.168.1.20:32400'),
    ).toBeVisible();
    expect(screen.getByText(/at PlexApiClient\.doRequest/)).toBeInTheDocument();
    expect(screen.getByText('library')).toBeInTheDocument();
    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide details for Scan failed' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('keeps an open row open when new lines arrive', async () => {
    const { user, rerenderWith } = renderView('table');
    await user.click(
      screen.getByRole('button', { name: 'Show details for Scan failed' }),
    );
    rerenderWith({ lines: [line(4, 'info', 'Newer line'), ...lines] });
    expect(messages()[0]).toBe('Newer line');
    expect(screen.getByText(/at PlexApiClient\.doRequest/)).toBeVisible();
  });

  test('filters lines by level', async () => {
    const { user } = renderView('table');
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.click(screen.getByRole('combobox', { name: 'Filter by Level' }));
    await user.click(screen.getByRole('option', { name: 'warn' }));
    await user.click(screen.getByRole('option', { name: 'error' }));
    await user.keyboard('{Escape}');
    expect(messages()).toEqual(['Scan failed', 'Low disk']);
  });

  test('downloads as many lines as the table shows, or the whole file', () => {
    renderView('table');
    expect(
      screen.getByRole('link', { name: 'Download last 3 lines' }),
    ).toHaveAttribute('href', '/logs?lineLimit=3');
    expect(
      screen.getByRole('link', { name: 'Download all logs' }),
    ).toHaveAttribute('href', '/logs');
  });

  test('explains an empty log', () => {
    renderView('table', { lines: [] });
    expect(screen.getByText('No log lines yet')).toBeInTheDocument();
  });
});

describe('SystemLogsView pause', () => {
  test('shows the stream is live and pauses it', async () => {
    const { user, onTogglePause } = renderView('table');
    expect(screen.getByText('Live')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onTogglePause).toHaveBeenCalledOnce();
  });

  test('counts the lines that arrived while paused', async () => {
    const { user, onTogglePause } = renderView('table', {
      paused: true,
      newWhilePaused: 4,
    });
    expect(screen.getByText('Paused, 4 new lines')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onTogglePause).toHaveBeenCalledOnce();
  });
});

describe('SystemLogsView cards', () => {
  test('shows one entry per line and opens one on tap', async () => {
    const { user } = renderView('cards');
    expect(screen.getAllByRole('article')).toHaveLength(3);

    await user.click(
      screen.getByRole('button', { name: 'Show details for Scan failed' }),
    );
    const entry = within(screen.getByRole('article', { name: 'Scan failed' }));
    expect(entry.getByText(/at PlexApiClient\.doRequest/)).toBeVisible();
    expect(entry.getByText('Movies')).toBeInTheDocument();
  });

  test('explains an empty log', () => {
    renderView('cards', { lines: [] });
    expect(screen.getByText('No log lines yet')).toBeInTheDocument();
  });
});
