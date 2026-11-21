import type { LoudnormConfig } from '@tunarr/types';
import type { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { TranscodeConfigOrm } from '../db/schema/TranscodeConfig.ts';

export type AudioLevels = {
  volumePercent: number;
  loudnormConfig: LoudnormConfig | null;
};

type AudioLevelSettings = Pick<
  TranscodeConfigOrm,
  | 'audioVolumePercent'
  | 'audioLoudnormConfig'
  | 'fillerAudioVolumePercent'
  | 'fillerAudioLoudnormConfig'
>;

/**
 * Filler list items and channel fallback items take the filler audio levels.
 * Each filler level left null falls back to the main transcode config level.
 */
export function resolveAudioLevels(
  transcodeConfig: AudioLevelSettings,
  lineupItemType?: StreamLineupItem['type'],
): AudioLevels {
  const channelLevels: AudioLevels = {
    volumePercent: transcodeConfig.audioVolumePercent,
    loudnormConfig: transcodeConfig.audioLoudnormConfig,
  };

  if (lineupItemType !== 'commercial' && lineupItemType !== 'fallback') {
    return channelLevels;
  }

  return {
    volumePercent:
      transcodeConfig.fillerAudioVolumePercent ?? channelLevels.volumePercent,
    loudnormConfig:
      transcodeConfig.fillerAudioLoudnormConfig ?? channelLevels.loudnormConfig,
  };
}
