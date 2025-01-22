import type { FfmpegEncoder } from '@/ffmpeg/ffmpegInfo.js';

export class FfmpegCapabilities {
  constructor(
    private options: Set<string>,
    // FFmpeg name to encoder details
    private videoEncoders: Map<string, FfmpegEncoder>,
  ) {}

  hasOption(option: string) {
    return this.options.has(option);
  }

  hasVideoEncoder(encoder: string) {
    return this.videoEncoders.has(encoder);
  }
}
