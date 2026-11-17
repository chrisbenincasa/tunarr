import { getApiTranscodeConfigsQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import { setTableColumnModel } from '@/store/settings/actions.ts';
import { navigateMock } from '@/test/routerMock.tsx';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
  withinRow,
} from '@/test/utils';
import type { TranscodeConfig } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TranscodeConfigsTable } from './TranscodeConfigsTable.tsx';

const mocks = vi.hoisted(() => ({ copy: vi.fn(), remove: vi.fn() }));

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  postApiTranscodeConfigsByIdCopyMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.copy(vars)),
  }),
  deleteApiTranscodeConfigsByIdMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.remove(vars)),
  }),
}));

const baseConfig: TranscodeConfig = {
  id: '',
  name: '',
  threadCount: 0,
  resolution: { widthPx: 1920, heightPx: 1080 },
  audioBitRate: 192,
  audioBufferSize: 576,
  audioChannels: 2,
  audioSampleRate: 48,
  audioFormat: 'aac',
  hardwareAccelerationMode: 'none',
  normalizeFrameRate: false,
  deinterlaceVideo: true,
  videoBitRate: 3500,
  videoBufferSize: 7000,
  videoFormat: 'h264',
  isDefault: false,
  audioVolumePercent: 100,
  disableChannelOverlay: false,
  errorScreen: 'pic',
  errorScreenAudio: 'silent',
  vaapiDevice: '',
  vaapiDriver: 'system',
  videoBitDepth: 8,
  videoPreset: '',
  videoProfile: '',
  disableHardwareDecoder: false,
  disableHardwareEncoding: false,
  disableHardwareFilters: false,
  audioLoudnormConfig: null,
};

const configs: TranscodeConfig[] = [
  { ...baseConfig, id: 'main-id', name: 'Main', isDefault: true },
  {
    ...baseConfig,
    id: 'qsv-id',
    name: 'Intel',
    hardwareAccelerationMode: 'qsv',
    resolution: { widthPx: 1280, heightPx: 720 },
    videoFormat: 'hevc',
    audioFormat: 'ac3',
  },
];

const renderTable = () =>
  renderWithProviders(<TranscodeConfigsTable />, {
    queryClient: seededQueryClient([
      [getApiTranscodeConfigsQueryKey(), configs],
    ]),
  });

describe('TranscodeConfigsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('shows resolution, hardware and formats for each config', () => {
    renderTable();
    const main = withinRow('Main');
    expect(main.getByText('1920x1080')).toBeInTheDocument();
    expect(main.getByText('Software (No GPU)')).toBeInTheDocument();
    expect(main.getByText('h264')).toBeInTheDocument();
    expect(main.getByText('aac')).toBeInTheDocument();

    const intel = withinRow('Intel');
    expect(intel.getByText('1280x720')).toBeInTheDocument();
    expect(intel.getByText('QuickSync')).toBeInTheDocument();
    expect(intel.getByText('hevc')).toBeInTheDocument();
    expect(intel.getByText('ac3')).toBeInTheDocument();
  });

  test('marks only the default config', () => {
    renderTable();
    expect(withinRow('Main').getByLabelText('Default Config')).toBeVisible();
    expect(
      withinRow('Intel').queryByLabelText('Default Config'),
    ).not.toBeInTheDocument();
  });

  test('links to the editor for each config and for a new one', () => {
    renderTable();
    expect(
      withinRow('Intel').getByRole('link', { name: 'Edit' }),
    ).toHaveAttribute('href', '/profiles/transcode/qsv-id');
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute(
      'href',
      '/profiles/transcode/new',
    );
  });

  test('opens the editor when a row is clicked', async () => {
    const { user } = renderTable();
    await user.click(withinRow('Intel').getByText('QuickSync'));
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/profiles/transcode/$configId',
      params: { configId: 'qsv-id' },
    });
  });

  // 2000x500 sorts after 1920x1080 as text but has fewer pixels.
  test('sorts resolution by pixel count', async () => {
    const wide: TranscodeConfig = {
      ...baseConfig,
      id: 'wide-id',
      name: 'Wide',
      resolution: { widthPx: 2000, heightPx: 500 },
    };
    const { user } = renderWithProviders(<TranscodeConfigsTable />, {
      queryClient: seededQueryClient([
        [getApiTranscodeConfigsQueryKey(), [...configs, wide]],
      ]),
    });
    await user.click(
      screen.getByRole('button', { name: /^Sort by Resolution/ }),
    );
    const resolutions = within(screen.getAllByRole('rowgroup')[1])
      .getAllByRole('row')
      .map((row) => within(row).getAllByRole('cell')[1].textContent);
    expect(resolutions).toEqual(['1280x720', '2000x500', '1920x1080']);
  });

  test('duplicates the config in the clicked row', async () => {
    const { user } = renderTable();
    await user.click(
      withinRow('Intel').getByRole('button', { name: 'Duplicate' }),
    );
    await waitFor(() =>
      expect(mocks.copy).toHaveBeenCalledWith({ path: { id: 'qsv-id' } }),
    );
  });

  test('deletes a config only after confirmation', async () => {
    const { user } = renderTable();
    await user.click(
      withinRow('Intel').getByRole('button', { name: 'Delete' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Delete Transcoding Config "Intel"?'),
    ).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({ path: { id: 'qsv-id' } }),
    );
  });

  // Saved visibility is keyed by column id, and MRT used the header text as
  // the id for this column.
  test('honors a Resolution column hidden under MRT', () => {
    setTableColumnModel('TranscodeConfigs', { Resolution: false });
    renderTable();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.queryByText('1920x1080')).not.toBeInTheDocument();
  });
});
