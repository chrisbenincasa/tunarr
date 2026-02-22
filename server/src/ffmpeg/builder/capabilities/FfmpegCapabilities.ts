import type { FfmpegEncoder } from '@/ffmpeg/ffmpegInfo.js';

export class FfmpegCapabilities {
  constructor(
    private options: ReadonlySet<string>,
    // FFmpeg name to encoder details
    private videoEncoders: ReadonlyMap<string, FfmpegEncoder>,
    private filters: ReadonlySet<string>,
    private hwAccels: ReadonlySet<string>,
  ) {}

  allOptions(): Set<string> {
    return new Set(this.options);
  }

  allVideoEncoders(): Map<string, FfmpegEncoder> {
    return new Map(this.videoEncoders);
  }

  allFilters(): Set<string> {
    return new Set(this.filters);
  }

  hasOption(option: string) {
    return this.options.has(option);
  }

  hasVideoEncoder(encoder: string) {
    return this.videoEncoders.has(encoder);
  }

  hasFilter(filter: string) {
    return this.filters.has(filter);
  }

  hasHardwareAccel(hwAccel: string) {
    return this.hwAccels.has(hwAccel);
  }
}

// Used for testing
export const EmptyFfmpegCapabilities = new FfmpegCapabilities(
  new Set(),
  new Map(),
  new Set(),
  new Set(),
);
