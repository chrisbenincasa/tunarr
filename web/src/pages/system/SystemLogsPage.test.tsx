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

// The open filter menu hides the rest of the page from the accessibility tree.
const messages = () =>
  within(screen.getAllByRole('rowgroup', { hidden: true })[1])
    .getAllByRole('row', { hidden: true })
    .map(
      (row) =>
        within(row).getAllByRole('cell', { hidden: true })[3].textContent,
    );

describe('SystemLogsPage', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('lists parsed log lines newest first', () => {
    renderWithProviders(<SystemLogsPage />);
    expect(stream().url).toMatch(/\/api\/system\/debug\/logs$/);

    stream().emit(logLine(30, 'Server started'), logLine(50, 'Scan failed'));
    expect(messages()).toEqual(['Scan failed', 'Server started']);

    const row = screen.getByText('Scan failed').closest('tr');
    if (!row) {
      throw new Error('No row for "Scan failed"');
    }
    const cells = within(row).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      new Date(1_700_000_000_000).toISOString(),
      'error',
      'Scanner',
      'Scan failed',
    ]);
  });

  test('drops lines that are not JSON or have an unknown level', () => {
    renderWithProviders(<SystemLogsPage />);
    stream().emit(
      'not json',
      logLine(99, 'Odd level'),
      logLine(40, 'Low disk'),
    );
    expect(messages()).toEqual(['Low disk']);
    expect(
      screen.getByText(/Displays the last 1 system log events/),
    ).toBeInTheDocument();
  });

  test('keeps only the newest 1000 lines', () => {
    renderWithProviders(<SystemLogsPage />);
    stream().emit(
      ...Array.from({ length: 1001 }, (_, i) => logLine(30, `line ${i}`)),
    );
    expect(
      screen.getByText(/Displays the last 1000 system log events/),
    ).toBeInTheDocument();
    expect(messages()[0]).toBe('line 1000');
  });

  test('filters lines by level', async () => {
    const { user } = renderWithProviders(<SystemLogsPage />);
    stream().emit(
      logLine(30, 'Server started'),
      logLine(40, 'Low disk'),
      logLine(50, 'Scan failed'),
    );
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.click(screen.getByRole('combobox', { name: 'Filter by Level' }));
    await user.click(screen.getByRole('option', { name: 'warn' }));
    await user.click(screen.getByRole('option', { name: 'error' }));
    expect(messages()).toEqual(['Scan failed', 'Low disk']);
  });

  test('limits the partial download to the rows on hand', () => {
    renderWithProviders(<SystemLogsPage />);
    stream().emit(logLine(30, 'one'), logLine(30, 'two'));
    expect(
      screen.getByRole('link', { name: /Download last/ }).getAttribute('href'),
    ).toMatch(/lineLimit=2$/);
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
