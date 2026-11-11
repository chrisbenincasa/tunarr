import useStore from '@/store/index.ts';
import { act, renderWithProviders, screen, within } from '@/test/utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SystemLogsPage } from './SystemLogsPage.tsx';

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners: Listener[] = [];
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(_type: string, listener: Listener) {
    this.listeners.push(listener);
  }

  close() {
    this.closed = true;
  }

  emit(...lines: string[]) {
    act(() => {
      for (const data of lines) {
        for (const listener of this.listeners) {
          listener(new MessageEvent('message', { data }));
        }
      }
    });
  }
}

const logLine = (level: number, msg: string, time = 1_700_000_000_000) =>
  JSON.stringify({ level, msg, time, caller: 'Scanner' });

const stream = () => {
  const source = FakeEventSource.instances.at(-1);
  if (!source) {
    throw new Error('SystemLogsPage opened no EventSource');
  }
  return source;
};

const messages = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell').at(-1)?.textContent);

describe('SystemLogsPage', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('lists parsed log lines newest first', () => {
    renderWithProviders(<SystemLogsPage />);
    expect(stream().url).toMatch(/\/api\/system\/debug\/logs$/);

    stream().emit(logLine(30, 'Server started'), logLine(50, 'Scan failed'));
    expect(messages()).toEqual(['Scan failed', 'Server started']);
  });

  test('drops lines that are not JSON or have an unknown level', () => {
    renderWithProviders(<SystemLogsPage />);
    stream().emit(
      'not json',
      logLine(99, 'Odd level'),
      logLine(40, 'Low disk'),
    );
    expect(messages()).toEqual(['Low disk']);
  });

  test('keeps only the newest 1000 lines', () => {
    renderWithProviders(<SystemLogsPage />);
    stream().emit(
      ...Array.from({ length: 1001 }, (_, i) => logLine(30, `line ${i}`)),
    );
    expect(
      screen.getByRole('link', { name: 'Download last 1,000 lines' }),
    ).toBeInTheDocument();
    expect(messages()[0]).toBe('line 1000');
  });

  test('holds the lines on screen while paused and counts new ones', async () => {
    const { user } = renderWithProviders(<SystemLogsPage />);
    stream().emit(logLine(30, 'Before pause'));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    stream().emit(logLine(30, 'During pause 1'), logLine(30, 'During pause 2'));
    expect(messages()).toEqual(['Before pause']);
    expect(screen.getByText('Paused, 2 new lines')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(messages()).toEqual([
      'During pause 2',
      'During pause 1',
      'Before pause',
    ]);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  test('limits the partial download to the lines on hand', () => {
    renderWithProviders(<SystemLogsPage />);
    stream().emit(logLine(30, 'one'), logLine(30, 'two'));
    expect(
      screen
        .getByRole('link', { name: 'Download last 2 lines' })
        .getAttribute('href'),
    ).toMatch(/download=true&pretty=true&lineLimit=2$/);
    expect(
      screen
        .getByRole('link', { name: 'Download all logs' })
        .getAttribute('href'),
    ).toMatch(/download=true&pretty=true$/);
  });

  test('closes the stream on unmount', () => {
    const { unmount } = renderWithProviders(<SystemLogsPage />);
    unmount();
    expect(stream().closed).toBe(true);
  });
});
