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
} as const;

export const AudioFormats = {
  Aac: 'aac',
  Ac3: 'ac3',
  Copy: 'copy',
  PCMS16LE: 'pcm_s16le',
  Flac: 'flac',
} as const;

export const OutputFormats = {
  None: 'none',
  Mkv: 'matroska',
  MpegTs: 'mpegts',
  Mp4: 'mp4',
  Hls: 'hls',
  Nut: 'nut',
} as const;
