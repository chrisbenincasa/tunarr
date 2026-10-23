import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import type { StreamEndPts } from '@/ffmpeg/GetLastPtsDuration.js';

export function calculateHlsPtsOffset(
  ends: StreamEndPts,
  config: Pick<TranscodeConfigOrm, 'audioFormat' | 'audioSampleRate'>,
): number {
  // FFmpeg's native AAC and AC3/EAC3 encoders timestamp their first packet
  // before input time zero (aacenc.c / ac3enc.c: initial_padding).
  const primingSamples =
    config.audioFormat === 'aac'
      ? 1024
      : config.audioFormat === 'ac3' || config.audioFormat === 'eac3'
        ? 256
        : 0;
  const primingTicks =
    primingSamples === 0
      ? 0
      : Math.ceil((primingSamples * 90_000) / (config.audioSampleRate * 1000));

  // One shared offset preserves A/V and subtitle alignment. Only audio
  // needs priming compensation; a later video end may already cover it.
  return (
    Math.max(ends.endPts, (ends.audioEndPts ?? -Infinity) + primingTicks) + 1
  );
}
