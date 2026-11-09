import { getApiFfmpegInfoQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import { useAppForm } from '@/hooks/form.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  within,
} from '@/test/utils';
import type { TranscodeConfig } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { TranscodeConfigAudioSettingsForm } from './TranscodeConfigAudioSettingsForm.tsx';
import { useBaseTranscodeConfigFormOptions } from './useTranscodeConfigFormOptions.ts';

const baseConfig: TranscodeConfig = {
  id: 'config-id',
  name: 'Main',
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
  isDefault: true,
  audioVolumePercent: 80,
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
  fillerAudioVolumePercent: null,
  fillerAudioLoudnormConfig: null,
};

const FormHarness = ({ initialConfig }: { initialConfig: TranscodeConfig }) => {
  const form = useAppForm({
    ...useBaseTranscodeConfigFormOptions(initialConfig),
  });

  return (
    <form.AppForm>
      <TranscodeConfigAudioSettingsForm initialConfig={initialConfig} />
      <form.Subscribe
        selector={(s) => ({
          volume: s.values.fillerAudioVolumePercent,
          loudnorm: s.values.fillerAudioLoudnormConfig,
        })}
        children={(values) => (
          <pre data-testid="filler-values">{JSON.stringify(values)}</pre>
        )}
      />
    </form.AppForm>
  );
};

const renderForm = (config: Partial<TranscodeConfig> = {}) =>
  renderWithProviders(
    <FormHarness initialConfig={{ ...baseConfig, ...config }} />,
    {
      queryClient: seededQueryClient([
        [getApiFfmpegInfoQueryKey(), { audioEncoders: [] }],
      ]),
    },
  );

// The filler Selects have no labelId, so their combobox has no accessible
// name. Find each one through its FormControl label instead.
const selectFor = (label: string) => {
  const control = screen.getByText(label, { selector: 'label' }).parentElement;
  if (!control) {
    throw new Error(`No form control for "${label}"`);
  }
  return within(control).getByRole('combobox');
};

const fillerValues = () =>
  JSON.parse(screen.getByTestId('filler-values').textContent ?? '{}') as {
    volume?: number | null;
    loudnorm?: TranscodeConfig['fillerAudioLoudnormConfig'];
  };

describe('TranscodeConfigAudioSettingsForm filler audio', () => {
  test('starts on "Same as channel" when both filler fields are null', () => {
    renderForm();

    expect(selectFor('Filler Audio Levels')).toHaveTextContent(
      'Same as channel',
    );
    expect(screen.queryByLabelText('Filler Audio Volume')).toBeNull();
  });

  test('"Custom" copies the channel volume and leaves loudnorm inherited', async () => {
    const { user } = renderForm();

    await user.click(selectFor('Filler Audio Levels'));
    await user.click(screen.getByRole('option', { name: 'Custom' }));

    expect(screen.getByLabelText('Filler Audio Volume')).toHaveValue('80');
    expect(fillerValues()).toEqual({ volume: 80, loudnorm: null });
  });

  test('custom filler loudnorm starts from the channel loudnorm', async () => {
    const channelLoudnorm = { i: -24, lra: 7, tp: -2 };
    const { user } = renderForm({ audioLoudnormConfig: channelLoudnorm });

    await user.click(selectFor('Filler Audio Levels'));
    await user.click(screen.getByRole('option', { name: 'Custom' }));
    await user.click(selectFor('Filler Loudness Normalization'));
    await user.click(screen.getByRole('option', { name: 'Custom (loudnorm)' }));

    expect(fillerValues().loudnorm).toEqual(channelLoudnorm);
    expect(screen.getByLabelText('Filler Loudness Target')).toHaveValue('-24');
  });

  test('"Same as channel" clears both filler fields back to null', async () => {
    const { user } = renderForm({
      fillerAudioVolumePercent: 50,
      fillerAudioLoudnormConfig: { i: -30, lra: 7, tp: -2 },
    });

    const levels = selectFor('Filler Audio Levels');
    expect(levels).toHaveTextContent('Custom');
    expect(screen.getByLabelText('Filler Audio Volume')).toHaveValue('50');

    await user.click(levels);
    await user.click(screen.getByRole('option', { name: 'Same as channel' }));

    expect(fillerValues()).toEqual({ volume: null, loudnorm: null });
    expect(screen.queryByLabelText('Filler Audio Volume')).toBeNull();
  });
});
