import { HlsOptions, MpegDashOptions } from './ffmpeg.js';

export type HlsOutputFormat = {
  type: 'hls';
  hlsOptions?: Partial<HlsOptions>;
};

export type MpegDashOutputFormat = {
  type: 'dash';
  options?: Partial<MpegDashOptions>;
};

export type MpegTsOutputFormat = {
  type: 'mpegts';
};

export const MpegTsOutputFormat = {
  type: 'mpegts',
} satisfies MpegTsOutputFormat;

export type NutOutputFormat = {
  type: 'nut';
};

export const NutOutputFormat: NutOutputFormat = {
  type: 'nut',
} satisfies NutOutputFormat;

export function HlsOutputFormat(opts?: Partial<HlsOptions>): HlsOutputFormat {
  return {
    type: 'hls',
    hlsOptions: opts,
  };
}

export function MpegDashOutputFormat(
  opts?: Partial<MpegDashOptions>,
): MpegDashOutputFormat {
  return {
    type: 'dash',
    options: opts,
  };
}

export type OutputFormat =
  | HlsOutputFormat
  | NutOutputFormat
  | MpegDashOutputFormat
  | MpegTsOutputFormat;
