import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Maybe, Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { nth } from 'lodash-es';
import path from 'node:path';
import type { HlsOutputFormatType } from '../constants.ts';
import { OutputOption } from './OutputOption.ts';

type AdditionalOptions = {
  frameRate: Maybe<string>;
  isFirstTranscode: boolean;
  oneSecondGop: boolean;
};

export class HlsFormatOutputOption extends OutputOption {
  public static SegmentSeconds = 4;

  constructor(
    private desiredState: FrameState,
    private mediaFrameRate: Maybe<string>,
    private playlistPath: string,
    private segmentTemplate: string,
    private baseStreamUrl: string,
    private isFirstTranscode: boolean,
    private oneSecondGop: boolean,
    private segmentType: 'mpegts' | 'fmp4' = 'mpegts',
    private initFileFormat: Nullable<string>,
  ) {
    super();
  }

  static create(
    desiredState: FrameState,
    outputFormat: HlsOutputFormatType,
    options: AdditionalOptions,
  ) {
    const base = path.join(
      outputFormat.segmentBaseDirectory,
      outputFormat.streamBasePath,
    );
    return new HlsFormatOutputOption(
      desiredState,
      options.frameRate,
      path.join(base, outputFormat.streamNameFormat),
      path.join(base, outputFormat.segmentNameFormat),
      outputFormat.streamBaseUrl,
      options.isFirstTranscode,
      options.oneSecondGop,
      outputFormat.segmentType,
      outputFormat.fmp4InitFormat,
    );
  }

  options(): string[] {
    const frameRate =
      this.desiredState.frameRate ?? this.getFrameRateFromMedia();
    const gop = this.oneSecondGop
      ? frameRate
      : frameRate * HlsFormatOutputOption.SegmentSeconds;
    const opts = [
      '-g',
      `${gop}`,
      '-keyint_min',
      `${frameRate * HlsFormatOutputOption.SegmentSeconds}`,
      '-force_key_frames',
      `expr:gte(t,n_forced*${HlsFormatOutputOption.SegmentSeconds})`,
      '-f',
      'hls',
      '-hls_time',
      `${HlsFormatOutputOption.SegmentSeconds}`,
      '-hls_list_size',
      '0',
      '-segment_list_flags',
      '+live',
      '-hls_segment_type',
      this.segmentType,
      '-hls_segment_filename',
      this.segmentTemplate,
      '-hls_base_url',
      this.baseStreamUrl,
    ];

    if (this.segmentType === 'fmp4' && isNonEmptyString(this.initFileFormat)) {
      opts.push(
        // '-strftime',
        // '1',
        '-hls_fmp4_init_filename',
        this.initFileFormat,
      );
    }

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
        ...(this.segmentType === 'mpegts'
          ? ['-mpegts_flags', '+initial_discontinuity']
          : []),

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
