import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';

export function isHdrContent(videoStream: VideoStream): boolean {
  return videoStream.colorTransfer === 'smpte2084';
}
