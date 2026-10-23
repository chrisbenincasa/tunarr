import { parseVideoDecoderNames } from './ffmpegInfo.ts';

const decodersOutput = `Decoders:
 V..... = Video
 A..... = Audio
 S..... = Subtitle
 .F.... = Frame-level multithreading
 ..S... = Slice-level multithreading
 ...X.. = Codec is experimental
 ....B. = Supports draw_horiz_band
 .....D = Supports direct rendering method 1
 ------
 V....D h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V..... libdav1d             dav1d AV1 decoder by VideoLAN (codec av1)
 V....D libaom-av1           libaom AV1 (codec av1)
 V....D av1                  Alliance for Open Media AV1
 V..... av1_cuvid            Nvidia CUVID AV1 decoder (codec av1)
 A....D aac                  AAC (Advanced Audio Coding)
 S..... srt                  SubRip subtitle
`;

describe('parseVideoDecoderNames', () => {
  test('returns only video decoder names', () => {
    expect(parseVideoDecoderNames(decodersOutput)).toEqual([
      'h264',
      'libdav1d',
      'libaom-av1',
      'av1',
      'av1_cuvid',
    ]);
  });

  test('returns nothing for empty output', () => {
    expect(parseVideoDecoderNames('')).toEqual([]);
  });
});
