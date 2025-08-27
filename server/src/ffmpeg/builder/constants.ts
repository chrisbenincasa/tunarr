import type { MpegDashOptions } from '@/ffmpeg/ffmpeg.js';
import dayjs from 'dayjs';
import type { HlsSessionType } from '../../stream/Session.ts';
import type { Nullable } from '../../types/util.ts';

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

export type HlsOptionsLegacy = {
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
  segmentType: 'mpegts' | 'fmp4';
  fmpegInitFormat: Nullable<string>;
};

export type HlsOptions = {
  // Duration of each clip in seconds
  targetSegmentDuration: number;
  sessionId: string; // Generally the channel ID
  segmentType: 'mpegts' | 'fmp4';
  segmentBaseDirectory: string;
  streamBasePath: string;
  hlsSessionType: HlsSessionType;
  // Number of clips to have in the list
  listSize: number;
  deleteThreshold: Nullable<number>;
  appendSegments: boolean;
};

export type HlsOutputFormatType = {
  type: typeof OutputFormatTypes.Hls;
  get segmentType(): 'mpegts' | 'fmp4';
  set segmentType(t: 'mpegts' | 'fmp4');
  segmentBaseDirectory: string;
  streamBasePath: string;
  streamNameFormat: string;
  segmentNameFormat: string;
  streamBaseUrl: string;
  fmp4InitFormat: string;
  segmentExt: 'ts' | 'm4s';
};

export function HlsOutputFormat(opts: HlsOptions): HlsOutputFormatType {
  return new HlsOutputFormatImpl(opts);
}

class HlsOutputFormatImpl {
  readonly type = OutputFormatTypes.Hls;
  #now = +dayjs();

  static StreamNameFormat = 'stream.m3u8';

  constructor(private opts: HlsOptions) {}

  get targetSegmentDuration() {
    return this.opts.targetSegmentDuration;
  }

  get segmentType() {
    return this.opts.segmentType;
  }

  set segmentType(typ: 'mpegts' | 'fmp4') {
    this.opts.segmentType = typ;
  }

  get segmentBaseDirectory() {
    return this.opts.segmentBaseDirectory;
  }

  get streamBasePath() {
    return this.opts.streamBasePath;
  }

  get streamNameFormat() {
    return HlsOutputFormatImpl.StreamNameFormat;
  }

  get segmentExt() {
    switch (this.opts.segmentType) {
      case 'mpegts':
        return 'ts';
      case 'fmp4':
        return 'm4s';
    }
  }

  get segmentNameFormat() {
    return 'data%06d.' + this.segmentExt;
  }

  get streamBaseUrl() {
    return `/stream/channels/${this.opts.sessionId}/${this.opts.hlsSessionType}/`;
  }

  get fmp4InitFormat() {
    return `${this.opts.sessionId}|${this.opts.hlsSessionType}|${this.#now}_init.mp4`;
  }
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
  | HlsOutputFormatType
  | NutOutputFormat
  | MkvOutputFormat
  | MpegDashOutputFormat
  | Mp4OutputFormat
  | MpegTsOutputFormat;
