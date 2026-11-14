import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import {
  getApiSettingsMediaSourceQueryKey,
  getApiTasksQueryKey,
} from '@/generated/@tanstack/react-query.gen.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
} from '@/test/utils';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Task } from '@tunarr/types';
import type { LibraryScanSchedule } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { ScannerSettingsPage } from './ScannerSettingsPage.tsx';

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  putApiSettingsMediaSourceMutation: () => ({
    mutationFn: (vars: { body: unknown }) => {
      mocks.save(vars);
      return Promise.resolve(vars.body);
    },
  }),
}));

const nextEpoch = 1_800_000_000;

const tasks: Task[] = [
  {
    id: 'ScanLibrariesTask',
    name: 'ScanLibrariesTask',
    scheduledTasks: [
      { running: false, nextExecutionEpoch: nextEpoch, args: {} },
    ],
  },
];

const renderPage = (scanSchedule: LibraryScanSchedule) =>
  renderWithProviders(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ScannerSettingsPage />
    </LocalizationProvider>,
    {
      queryClient: seededQueryClient([
        [getApiSettingsMediaSourceQueryKey(), { scanSchedule }],
        [getApiTasksQueryKey(), tasks],
      ]),
    },
  );

const savedSchedule = () =>
  (mocks.save.mock.calls[0]?.[0] as { body: { scanSchedule: unknown } }).body
    .scanSchedule;

describe('ScannerSettingsPage', () => {
  beforeAll(() => {
    dayjs.extend(localeData);
    dayjs.extend(localizedFormat);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows when the next scheduled scan runs', () => {
    renderPage({ type: 'interval', hours: 6, minute: 30 });

    const next = dayjs(nextEpoch * 1000).format('llll');
    expect(screen.getByText(`Next scan: ${next}`)).toBeInTheDocument();
  });

  test('says scans are off when the saved schedule is off', () => {
    renderPage({ type: 'off' });

    expect(screen.getByText(/Scheduled scans are off/)).toBeInTheDocument();
  });

  test('saves scans as off', async () => {
    const { user } = renderPage({ type: 'interval', hours: 6, minute: 30 });

    await user.click(screen.getByRole('combobox', { name: 'Scheduled scans' }));
    await user.click(screen.getByRole('option', { name: 'Off' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(savedSchedule()).toEqual({ type: 'off' });
  });

  test('saves a new interval', async () => {
    const { user } = renderPage({ type: 'interval', hours: 6, minute: 30 });

    await user.click(screen.getByRole('combobox', { name: 'Frequency' }));
    await user.click(screen.getByRole('option', { name: 'Every 12 hours' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(savedSchedule()).toEqual({
      type: 'interval',
      hours: 12,
      minute: 30,
    });
  });

  test('saves the selected days', async () => {
    const { user } = renderPage({
      type: 'days',
      daysOfWeek: [1, 3],
      hour: 4,
      minute: 0,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Fri' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(savedSchedule()).toEqual({
      type: 'days',
      daysOfWeek: [3, 5],
      hour: 4,
      minute: 0,
    });
  });

  test('requires at least one day', async () => {
    const { user } = renderPage({
      type: 'days',
      daysOfWeek: [1],
      hour: 4,
      minute: 0,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Mon' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Pick at least one day.'),
    ).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  test('requires a cron expression', async () => {
    const { user } = renderPage({ type: 'interval', hours: 6, minute: 30 });

    await user.click(screen.getByRole('combobox', { name: 'Scheduled scans' }));
    await user.click(screen.getByRole('option', { name: 'Custom (cron)' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Enter a cron expression.'),
    ).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
