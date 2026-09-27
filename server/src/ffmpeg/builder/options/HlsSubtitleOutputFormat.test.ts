import { describe, expect, test } from 'vitest';
import { HlsSubtitleOutputFormat } from './HlsSubtitleOutputFormat.ts';

function makeFormat(ptsOffsetSeconds = 0) {
  return new HlsSubtitleOutputFormat(
    '/some/path/subs.m3u8',
    '/some/path/sub%06d.vtt',
    '/stream/channels/test-uuid/hls/',
    '0:s:0',
    ptsOffsetSeconds,
  );
}

describe('HlsSubtitleOutputFormat', () => {
  test('always includes -avoid_negative_ts disabled', () => {
    const opts = makeFormat().options();
    const idx = opts.indexOf('-avoid_negative_ts');
    expect(idx).toBeGreaterThan(-1);
    expect(opts[idx + 1]).toBe('disabled');
  });

  test('-avoid_negative_ts disabled is present alongside a pts offset', () => {
    const opts = makeFormat(3600).options();
    const idx = opts.indexOf('-avoid_negative_ts');
    expect(idx).toBeGreaterThan(-1);
    expect(opts[idx + 1]).toBe('disabled');
    expect(opts).toContain('-output_ts_offset');
  });
});
