import type { MediaStream } from '@tunarr/types';
import type { StreamDetails } from '../../stream/types.ts';

// Maps ffprobe stream details for a local file to the streams stored on its
// program version.
export function mediaStreamsFromProbe(details: StreamDetails): MediaStream[] {
  const streams: MediaStream[] = [];

  for (const videoStream of details.videoDetails ?? []) {
    streams.push({
      ...videoStream,
      bitDepth: videoStream.bitDepth,
      streamType: 'video',
      codec: videoStream.codec ?? 'unknown',
      channels: null,
      index: videoStream.streamIndex ?? 0,
      default: true,
      title: 'Main',
      profile: videoStream.profile ?? null,
      pixelFormat: videoStream.pixelFormat ?? null,
      colorPrimaries: videoStream.colorPrimaries ?? null,
      colorRange: videoStream.colorRange ?? null,
      colorSpace: videoStream.colorSpace ?? null,
      colorTransfer: videoStream.colorTransfer ?? null,
    });
  }

  for (const audioStream of details.audioDetails ?? []) {
    streams.push({
      ...audioStream,
      streamType: 'audio',
      codec: audioStream.codec ?? 'unknown',
      channels: audioStream.channels ?? null,
      index: audioStream.index ?? 0,
      default: audioStream.default ?? false,
      languageCodeISO6392:
        audioStream.languageCodeISO6392 ?? audioStream.language,
      profile: audioStream.profile ?? null,
      pixelFormat: null,
    });
  }

  for (const subtitleStream of details.subtitleDetails ?? []) {
    streams.push({
      ...subtitleStream,
      streamType:
        subtitleStream.type === 'external' ? 'external_subtitles' : 'subtitles',
      codec: subtitleStream.codec ?? 'unknown',
      channels: null,
      index: subtitleStream.index ?? 0,
      default: subtitleStream.default,
      languageCodeISO6392:
        subtitleStream.languageCodeISO6392 ?? subtitleStream.language,
      profile: null,
      pixelFormat: null,
    });
  }

  return streams;
}
