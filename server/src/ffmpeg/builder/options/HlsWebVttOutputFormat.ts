import { OutputOption } from './OutputOption.ts';

/**
 * Appends FFmpeg segment muxer arguments for a parallel WebVTT subtitle output.
 * This is added as a second output to the FFmpeg command when WebVTT sidecar
 * subtitle delivery is enabled.
 */
export class HlsWebVttOutputFormat extends OutputOption {
  constructor(
    private subtitleInputIndex: number,
    private subtitleStreamIndex: number,
    private subtitlePlaylistPath: string,
    private subtitleSegmentTemplate: string,
    private subtitleBaseUrl: string,
    private segmentStartNumber: number,
  ) {
    super();
  }

  options(): string[] {
    return [
      '-map',
      `${this.subtitleInputIndex}:${this.subtitleStreamIndex}`,
      '-c:s',
      'webvtt',
      '-f',
      'segment',
      '-segment_format',
      'webvtt',
      '-segment_time',
      '4',
      '-segment_list',
      this.subtitlePlaylistPath,
      '-segment_list_flags',
      '+live',
      '-segment_list_entry_prefix',
      this.subtitleBaseUrl,
      '-segment_start_number',
      String(this.segmentStartNumber),
      '-break_non_keyframes',
      '1',
      this.subtitleSegmentTemplate,
    ];
  }
}
