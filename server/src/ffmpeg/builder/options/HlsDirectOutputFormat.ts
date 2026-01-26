import { OutputOption } from './OutputOption.ts';

/**
 * HLS output format for direct stream copy mode (no transcoding).
 * Unlike HlsOutputFormat, this does NOT include keyframe-forcing options
 * (-g, -keyint_min, -force_key_frames) which are incompatible with -c:v copy.
 * Segments will be created at source keyframe boundaries.
 */
export class HlsDirectOutputFormat extends OutputOption {
  public static SegmentSeconds = 4;

  constructor(
    private playlistPath: string,
    private segmentTemplate: string,
    private baseStreamUrl: string,
    private isFirstTranscode: boolean,
  ) {
    super();
  }

  options(): string[] {
    const opts = [
      '-f',
      'hls',
      '-hls_time',
      `${HlsDirectOutputFormat.SegmentSeconds}`,
      '-hls_list_size',
      '0',
      '-segment_list_flags',
      '+live',
      '-hls_segment_type',
      'mpegts',
      '-hls_segment_filename',
      this.segmentTemplate,
      '-hls_base_url',
      this.baseStreamUrl,
      '-copyts', // Preserve original timestamps
    ];

    if (this.isFirstTranscode) {
      opts.push(
        '-hls_flags',
        'program_date_time+append_list+omit_endlist+independent_segments',
        this.playlistPath,
      );
    } else {
      opts.push(
        '-hls_flags',
        'program_date_time+append_list+discont_start+omit_endlist+independent_segments',
        '-mpegts_flags',
        '+initial_discontinuity',
        this.playlistPath,
      );
    }

    return opts;
  }
}
