import { describe, expect, test } from 'vitest';
import { FfprobeMediaInfoSchema } from './ffmpeg.ts';

// Regression tests for https://github.com/chrisbenincasa/tunarr/issues/2078
//
// ffprobe omits the `tags` key entirely for chapters that have no tags
// (common on re-muxed MKVs, which also tend to carry chapter UIDs above
// Int32.MaxValue). The schema previously required `tags` on every chapter,
// so a single untagged chapter made the whole file's probe unparseable and
// the scan failed with "Unable to parse ffprobe output" / "Filter was not a
// match".
describe('FfprobeMediaInfoSchema chapters', () => {
  const baseProbe = {
    streams: [
      {
        index: 0,
        codec_name: 'h264',
        codec_long_name: 'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
        profile: 'High',
        codec_type: 'video',
        width: 1920,
        height: 1080,
        coded_width: 1920,
        coded_height: 1080,
        has_b_frames: 2,
        sample_aspect_ratio: '1:1',
        display_aspect_ratio: '16:9',
        pix_fmt: 'yuv420p',
        level: 40,
        r_frame_rate: '24000/1001',
        avg_frame_rate: '24000/1001',
        time_base: '1/1000',
        start_pts: 0,
        start_time: '0.000000',
        bits_per_raw_sample: '8',
      },
    ],
    format: {
      filename: 'file.mkv',
      nb_streams: 1,
      format_name: 'matroska,webm',
      format_long_name: 'Matroska / WebM',
      start_time: '0.000000',
      duration: '1320.810000',
      size: '1162966026',
      bit_rate: '7043956',
      probe_score: 100,
    },
  } as const;

  test('parses chapters without tags and with ids above Int32.MaxValue', () => {
    const result = FfprobeMediaInfoSchema.safeParse({
      ...baseProbe,
      chapters: [
        {
          // MKV chapter UIDs are arbitrary uint32 values; muxers generate
          // them above Int32.MaxValue (2147483647) all the time.
          id: 3134560868,
          time_base: '1/1000000000',
          start: 83000000,
          start_time: '0.083000',
          end: 6089000000,
          end_time: '6.089000',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chapters?.[0]?.id).toBe(3134560868);
    }
  });

  test('preserves chapter tags when they are present', () => {
    const result = FfprobeMediaInfoSchema.safeParse({
      ...baseProbe,
      chapters: [
        {
          id: 595137229,
          time_base: '1/1000000000',
          start: 6089000000,
          start_time: '6.089000',
          end: 1316817000000,
          end_time: '1316.817000',
          tags: { title: 'Opening' },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chapters?.[0]?.tags).toEqual({ title: 'Opening' });
    }
  });
});
