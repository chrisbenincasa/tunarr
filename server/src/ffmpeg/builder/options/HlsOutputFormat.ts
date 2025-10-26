import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { OutputOption } from './OutputOption.ts';

export class HlsOutputFormat extends OutputOption {
  public static SegmentSeconds = 4;

  constructor(
    private desiredState: FrameState,
    private mediaFrameRate: number,
    private playlistPath: string,
    private segmentTemplate: string,
    private baseStreamUrl: string,
    private isFirstTranscode: boolean,
    private oneSecondGop: boolean,
  ) {
    super();
  }

  options(): string[] {
    const frameRate = this.desiredState.frameRate ?? this.mediaFrameRate;
    const gop = this.oneSecondGop
      ? frameRate
      : frameRate * HlsOutputFormat.SegmentSeconds;
    const opts = [
      '-g',
      `${gop}`,
      '-keyint_min',
      `${frameRate * HlsOutputFormat.SegmentSeconds}`,
      '-force_key_frames',
      `expr:gte(t,n_forced*${HlsOutputFormat.SegmentSeconds})`,
      '-f',
      'hls',
      '-hls_time',
      `${HlsOutputFormat.SegmentSeconds}`,
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
