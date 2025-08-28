import type { DeepRequired } from 'ts-essentials';
import type { Nullable } from '../../types/util.ts';

export type HlsOptions = {
  hlsTime: number; // Duration of each clip in seconds,
  hlsListSize: number; // Number of clips to have in the list
  hlsDeleteThreshold: number;
  segmentBaseDirectory: string;
  streamBasePath: string;
  streamBaseUrl: string;
  segmentNameFormat: string;
  streamNameFormat: string;
  deleteThreshold: Nullable<number>;
  appendSegments: boolean;
};

export const defaultHlsOptions: DeepRequired<HlsOptions> = {
  hlsTime: 2,
  hlsListSize: 3,
  hlsDeleteThreshold: 3,
  segmentBaseDirectory: 'streams', // Relative to cwd
  streamBasePath: 'stream_%v',
  segmentNameFormat: 'data%05d.ts',
  streamNameFormat: 'stream.m3u8',
  streamBaseUrl: 'hls/',
  deleteThreshold: 3,
  appendSegments: false,
};

export type MpegDashOptions = {
  windowSize: number; // number of segments kept in the manifest
  segmentDuration: number; // segment duration in secodns
  segmentType: 'auto' | 'mp4' | 'webm';
  fragType: 'auto' | 'every_frame' | 'duration' | 'pframes';
};

export const defaultMpegDashOptions: DeepRequired<MpegDashOptions> = {
  segmentDuration: 2,
  windowSize: 3,
  segmentType: 'auto',
  fragType: 'auto',
};

export const VideoFormats = {
  Hevc: 'hevc',
  H264: 'h264',
  Mpeg1Video: 'mpeg1video',
  Mpeg2Video: 'mpeg2video',
  MsMpeg4V2: 'msmpeg4v2',
  MsMpeg4V3: 'msmpeg4v3',
  Vc1: 'vc1',
  Mpeg4: 'mpeg4',
  Vp9: 'vp9',
  Av1: 'av1',
  MpegTs: 'mpegts',
  Copy: 'copy',
  Raw: 'raw',
  Undetermined: '',
} as const;

export type VideoFormat = (typeof VideoFormats)[keyof typeof VideoFormats];

export const AudioFormats = {
  Aac: 'aac',
  Ac3: 'ac3',
  Copy: 'copy',
  PCMS16LE: 'pcm_s16le',
  Flac: 'flac',
} as const;

export const OutputLocation = {
  Stdout: 'stdout',
} as const;

export const OutputFormatTypes = {
  None: 'none',
  Mkv: 'mkv',
  MpegTs: 'mpegts',
  Mp4: 'mp4',
  Hls: 'hls',
  Nut: 'nut',
  Dash: 'dash',
} as const;

export type OutputLocation = Lowercase<keyof typeof OutputLocation>;

export type HlsOutputFormat = {
  type: typeof OutputFormatTypes.Hls;
  hlsOptions: HlsOptions;
};

export type MpegDashOutputFormat = {
  type: 'dash';
  options?: Partial<MpegDashOptions>;
};

export type MpegTsOutputFormat = {
  type: typeof OutputFormatTypes.MpegTs;
};

export const MpegTsOutputFormat = {
  type: OutputFormatTypes.MpegTs,
} as const satisfies MpegTsOutputFormat;

export type MkvOutputFormat = {
  type: typeof OutputFormatTypes.Mkv;
};

export const MkvOutputFormat = {
  type: OutputFormatTypes.Mkv,
} as const satisfies MkvOutputFormat;

export type Mp4OutputFormat = {
  type: typeof OutputFormatTypes.Mp4;
};

export const Mp4OutputFormat = {
  type: OutputFormatTypes.Mp4,
} satisfies Mp4OutputFormat;

export type NutOutputFormat = {
  type: typeof OutputFormatTypes.Nut;
};

export const NutOutputFormat = {
  type: OutputFormatTypes.Nut,
} as const satisfies NutOutputFormat;

export function HlsOutputFormat(opts: HlsOptions): HlsOutputFormat {
  return {
    type: OutputFormatTypes.Hls,
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
  | MkvOutputFormat
  | MpegDashOutputFormat
  | Mp4OutputFormat
  | MpegTsOutputFormat;
