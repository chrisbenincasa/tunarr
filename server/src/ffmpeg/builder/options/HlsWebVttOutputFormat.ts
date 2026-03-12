import { OutputOption } from './OutputOption.ts';

/**
 * Appends FFmpeg segment muxer arguments for a parallel WebVTT subtitle output.
 * This is added as a second output to the FFmpeg command when WebVTT sidecar
 * subtitle delivery is enabled.
 */
type HlsWebVttOutputFormatOptions = {
  subtitleInputIndex: number;
  subtitleStreamIndex: number;
  subtitlePlaylistPath: string;
  subtitleSegmentTemplate: string;
  subtitleBaseUrl: string;
  segmentStartNumber: number;
};

export class HlsWebVttOutputFormat extends OutputOption {
  constructor(private opts: HlsWebVttOutputFormatOptions) {
    super();
  }

  options(): string[] {
    return [
      '-map',
      `${this.opts.subtitleInputIndex}:${this.opts.subtitleStreamIndex}`,
      '-c:s',
      'webvtt',
      '-f',
      'segment',
      '-segment_format',
      'webvtt',
      '-segment_time',
      '4',
      '-segment_list',
      this.opts.subtitlePlaylistPath,
      '-segment_list_flags',
      '+live',
      '-segment_list_entry_prefix',
      this.opts.subtitleBaseUrl,
      '-segment_start_number',
      String(this.opts.segmentStartNumber),
      '-break_non_keyframes',
      '1',
      this.opts.subtitleSegmentTemplate,
    ];
  }
}
