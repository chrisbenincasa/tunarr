import { Box } from '@mui/material';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SystemLogsView } from './SystemLogsView.tsx';
import type { LogLevel, LogLine } from './logLine.ts';

// Fixed instants keep the screenshots stable.
const base = 1_798_000_000_000;

const line = (
  id: number,
  level: LogLevel,
  caller: string,
  msg: string,
  extra: Partial<LogLine> = {},
): LogLine => ({
  id,
  time: base + id * 4_000,
  level,
  caller,
  msg,
  context: {},
  raw: JSON.stringify({ level, caller, msg }),
  ...extra,
});

const scanFailed = line(
  9,
  'error',
  'ScanLibrariesTask',
  'Scan failed for library Movies',
  {
    err: {
      type: 'AxiosError',
      message: 'connect ECONNREFUSED 192.168.1.20:32400',
      stack: [
        'AxiosError: connect ECONNREFUSED 192.168.1.20:32400',
        '    at TCPConnectWrap.afterConnect (node:net:1611:16)',
        '    at PlexApiClient.doRequest (server/src/external/plex/PlexApiClient.ts:212:15)',
        '    at ScanLibrariesTask.runInternal (server/src/tasks/ScanLibrariesTask.ts:64:9)',
      ].join('\n'),
    },
    context: {
      task: 'ScanLibrariesTask',
      library: 'Movies',
      mediaSource: 'Living Room (Plex)',
    },
  },
);

const storyLines: LogLine[] = [
  line(
    10,
    'info',
    'HlsSession',
    'Session started for channel 4 (Retro Cartoons)',
  ),
  scanFailed,
  line(
    8,
    'warn',
    'PlexApiClient',
    'Request to Plex server Living Room timed out after 30000 ms, retrying (2 of 3)',
  ),
  line(
    7,
    'info',
    'UpdateXmlTvTask',
    'XMLTV updated at 2026-12-23T09:40:55-05:00',
    {
      context: { task: 'UpdateXmlTvTask' },
    },
  ),
  line(
    6,
    'debug',
    'ChannelLineupService',
    'Regenerated lineup for channel 2 with 418 items',
  ),
  line(5, 'info', 'TunarrWorker', 'Tunarr worker started', {
    context: { worker: true },
  }),
  line(4, 'http', 'FastifyServer', 'GET /api/channels 200 12ms'),
  line(
    3,
    'info',
    'BackupTask',
    'Wrote backup archive tunarr-backup-2026-12-23.zip (48.2 MB)',
  ),
];

const longLine = line(
  11,
  'error',
  'ReconcileProgramDurationsTaskWithAnExtraLongName',
  'Program durations drifted for 1,284 items across 37 channels, so their lineups were rebuilt and the guide was regenerated, which took longer than the scheduled window allows on this server',
  {
    err: {
      type: 'TimeoutError',
      message:
        'Operation exceeded 120000 ms while waiting on /media/very/long/path/to/a/network/share/with/nested/folders/Show Name (2004)/Season 01/Show Name - S01E01 - Pilot.mkv',
      stack:
        'TimeoutError: Operation exceeded 120000 ms\n    at withTimeout (server/src/util/promises/withTimeoutAndExtraLongFunctionNameThatKeepsGoing.ts:41:11)',
    },
  },
);

const meta = {
  title: 'System/SystemLogsView',
  component: SystemLogsView,
  args: {
    lines: storyLines,
    paused: false,
    newWhilePaused: 0,
    onTogglePause: fn(),
    downloadUrl: (limit?: number) => (limit ? `#last-${limit}` : '#all'),
  },
} satisfies Meta<typeof SystemLogsView>;

export default meta;

type Story = StoryObj<typeof meta>;

// The table shows at every density. Only phones get the entry list.
export const Default: Story = {};

// Phone stories force the entry list and draw it at phone width.
const phoneWidth: Decorator = (Story) => (
  <Box sx={{ width: 390 }}>
    <Story />
  </Box>
);

const phone = { layout: 'cards' } as const;

export const Phone: Story = { args: phone, decorators: [phoneWidth] };

export const Paused: Story = { args: { paused: true, newWhilePaused: 12 } };

export const ExpandedError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Show details for Scan failed for library Movies',
      }),
    );
    await expect(canvas.getByText(/at PlexApiClient\.doRequest/)).toBeVisible();
    await expect(canvas.getByText('Living Room (Plex)')).toBeVisible();
  },
};

export const ExpandedPhone: Story = {
  args: phone,
  decorators: [phoneWidth],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Show details for Scan failed for library Movies',
      }),
    );
    await expect(canvas.getByText(/at PlexApiClient\.doRequest/)).toBeVisible();
  },
};

export const LongText: Story = {
  args: { lines: [longLine, ...storyLines] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole('button', { name: /^Show details for Program/ })[0],
    );
  },
};

export const LongTextPhone: Story = {
  args: { ...phone, lines: [longLine, ...storyLines] },
  decorators: [phoneWidth],
};

export const Empty: Story = { args: { lines: [] } };

export const EmptyPhone: Story = {
  args: { ...phone, lines: [] },
  decorators: [phoneWidth],
};

export const PauseToggle: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(args.onTogglePause).toHaveBeenCalledOnce();
  },
};
