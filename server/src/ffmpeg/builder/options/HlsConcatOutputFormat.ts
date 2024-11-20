import { HlsOutputFormat } from './HlsOutputFormat.ts';
import { OutputOption } from './OutputOption.ts';

export class HlsConcatOutputFormat extends OutputOption {
  constructor(
    private segmentTemplate: string,
    private playlistPath: string,
    private baseUrl: string,
  ) {
    super();
  }

  options(): string[] {
    const segmentType = this.segmentTemplate.includes('m4s')
      ? 'fmp4'
      : 'mpegts';
    return [
      '-g',
      `${HlsOutputFormat.SegmentSeconds}/2`,
      '-force_key_frames',
      `expr:gte(t,n_forced*${HlsOutputFormat.SegmentSeconds}/2)`,
      '-f',
      'hls',
      '-hls_segment_type',
      segmentType,
      '-hls_time',
      `${HlsOutputFormat.SegmentSeconds}`,
      '-hls_list_size',
      '25',
      '-segment_list_flags',
      '+live',
      '-hls_segment_filename',
      this.segmentTemplate,
      '-hls_base_url',
      this.baseUrl,
      '-hls_flags',
      'delete_segments+program_date_time+omit_endlist+discont_start+independent_segments',
      '-master_pl_name',
      'playlist.m3u8',
      this.playlistPath,
    ];
  }
}
