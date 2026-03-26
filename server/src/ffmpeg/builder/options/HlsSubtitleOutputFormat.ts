import { OutputOption } from './OutputOption.ts';

/**
 * HLS subtitle sidecar output using the FFmpeg `segment` muxer with webvtt format.
 * Produces raw .vtt segment files and an HLS media playlist, which is the correct
 * format for WebVTT subtitle renditions per the HLS spec. The `hls` muxer cannot
 * be used here because it defaults to mpegts segments, which cannot carry WebVTT.
 */
export class HlsSubtitleOutputFormat extends OutputOption {
  public static SegmentSeconds = 4;

  constructor(
    private subtitlePlaylistPath: string,
    private segmentTemplate: string,
    private baseStreamUrl: string,
    private subtitleMapRef: string,
    // Offset in seconds to align subtitle cue timestamps with the video PTS
    // timeline across transcode boundaries. Must match the video -output_ts_offset.
    private ptsOffsetSeconds: number = 0,
  ) {
    super();
  }

  options(): string[] {
    const opts: string[] = [];

    // Apply the same PTS offset as the video output so subtitle cue timestamps
    // stay in sync with the MPEG-TS PTS clock across transcode boundaries.
    // This lets us use a constant X-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000
    // when serving the segments.
    if (this.ptsOffsetSeconds > 0) {
      opts.push('-output_ts_offset', `${this.ptsOffsetSeconds}`);
    }

    opts.push(
      '-map',
      this.subtitleMapRef,
      '-c:s',
      'webvtt',
      '-f',
      'segment',
      '-segment_time',
      `${HlsSubtitleOutputFormat.SegmentSeconds}`,
      '-segment_list',
      this.subtitlePlaylistPath,
      '-segment_list_type',
      'hls',
      '-segment_list_flags',
      'live',
      // Keep a rolling window of 20 entries so that #EXT-X-MEDIA-SEQUENCE
      // advances as the stream progresses. Without this, the playlist always
      // shows #EXT-X-MEDIA-SEQUENCE:0 and clients that re-enable subtitles
      // try to fetch segments from the beginning, which may no longer exist.
      '-segment_list_size',
      '20',
      '-segment_format',
      'webvtt',
      '-segment_list_entry_prefix',
      this.baseStreamUrl,
      this.segmentTemplate,
    );

    return opts;
  }
}
