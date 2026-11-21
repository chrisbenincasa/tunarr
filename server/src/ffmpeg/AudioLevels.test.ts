import { describe, expect, test } from 'vitest';
import { resolveAudioLevels } from './AudioLevels.ts';

const channelLoudnorm = { i: -24, lra: 7, tp: -2 };
const fillerLoudnorm = { i: -30, lra: 7, tp: -2 };

const baseConfig = {
  audioVolumePercent: 100,
  audioLoudnormConfig: channelLoudnorm,
  fillerAudioVolumePercent: null,
  fillerAudioLoudnormConfig: null,
};

describe('resolveAudioLevels', () => {
  test('uses the channel levels for regular programs', () => {
    const levels = resolveAudioLevels(
      {
        ...baseConfig,
        fillerAudioVolumePercent: 50,
        fillerAudioLoudnormConfig: fillerLoudnorm,
      },
      'program',
    );

    expect(levels).toEqual({
      volumePercent: 100,
      loudnormConfig: channelLoudnorm,
    });
  });

  test.each(['commercial', 'fallback'] as const)(
    'uses the filler levels for %s items',
    (type) => {
      const levels = resolveAudioLevels(
        {
          ...baseConfig,
          fillerAudioVolumePercent: 50,
          fillerAudioLoudnormConfig: fillerLoudnorm,
        },
        type,
      );

      expect(levels).toEqual({
        volumePercent: 50,
        loudnormConfig: fillerLoudnorm,
      });
    },
  );

  test('falls back to each channel level the filler leaves unset', () => {
    expect(
      resolveAudioLevels(
        { ...baseConfig, fillerAudioVolumePercent: 60 },
        'commercial',
      ),
    ).toEqual({ volumePercent: 60, loudnormConfig: channelLoudnorm });

    expect(
      resolveAudioLevels(
        { ...baseConfig, fillerAudioLoudnormConfig: fillerLoudnorm },
        'commercial',
      ),
    ).toEqual({ volumePercent: 100, loudnormConfig: fillerLoudnorm });
  });

  test('turns on loudnorm for filler when the channel has none', () => {
    const levels = resolveAudioLevels(
      {
        ...baseConfig,
        audioLoudnormConfig: null,
        fillerAudioLoudnormConfig: fillerLoudnorm,
      },
      'fallback',
    );

    expect(levels.loudnormConfig).toEqual(fillerLoudnorm);
  });
});
