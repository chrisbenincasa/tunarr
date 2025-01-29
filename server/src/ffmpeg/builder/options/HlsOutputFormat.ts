import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { nth } from 'lodash-es';
import { OutputOption } from './OutputOption.ts';

export class HlsOutputFormat extends OutputOption {
  public static SegmentSeconds = 4;

  constructor(
    private desiredState: FrameState,
    private mediaFrameRate: Maybe<string>,
    private playlistPath: string,
    private segmentTemplate: string,
    private baseStreamUrl: string,
    private isFirstTranscode: boolean,
    private oneSecondGop: boolean,
  ) {
    super();
  }

  options(): string[] {
    const frameRate =
      this.desiredState.frameRate ?? this.getFrameRateFromMedia();
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

  private getFrameRateFromMedia() {
    let frameRate = 24;
    if (isNonEmptyString(this.mediaFrameRate)) {
      const intParsed = parseInt(this.mediaFrameRate);
      if (isNaN(intParsed)) {
        const parts = this.mediaFrameRate.split('/');
        const numerator = nth(parts, 0);
        const denominator = nth(parts, 1);
        let rate = 24;
        if (isNonEmptyString(numerator) && isNonEmptyString(denominator)) {
          const numeratorInt = parseInt(numerator);
          const denominatorInt = parseInt(denominator);
          if (!isNaN(numeratorInt) && !isNaN(denominatorInt)) {
            rate = Math.round(numeratorInt / denominatorInt);
          }
        }
        frameRate = rate;
      }
    }

    return frameRate;
  }
}
