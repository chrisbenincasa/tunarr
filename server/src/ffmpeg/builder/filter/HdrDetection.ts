import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { ColorTransferFormats } from '@/ffmpeg/builder/constants.js';

export function isHdrContent(videoStream: VideoStream): boolean {
  return (
    videoStream.colorTransfer === ColorTransferFormats.Smpte2084 ||
    videoStream.colorTransfer === ColorTransferFormats.AribStdB67
  );
}
