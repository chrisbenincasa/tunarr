import { describe, expect, test } from 'vitest';
import { injectTimestampMap } from './streamApi.js';

describe('injectTimestampMap', () => {
  test('injects X-TIMESTAMP-MAP after bare WEBVTT header', () => {
    const input = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
    const result = injectTimestampMap(input);
    expect(result).toBe(
      'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000\n\n00:00:01.000 --> 00:00:02.000\nHello\n',
    );
  });

  test('injects after WEBVTT header with metadata on the same line', () => {
    const input = 'WEBVTT - some metadata\n\ncue content\n';
    const result = injectTimestampMap(input);
    expect(result).toBe(
      'WEBVTT - some metadata\nX-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000\n\ncue content\n',
    );
  });

  test('preserves CRLF line endings on the header line', () => {
    const input = 'WEBVTT\r\n\r\ncue content\r\n';
    const result = injectTimestampMap(input);
    expect(result).toBe(
      'WEBVTT\r\nX-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000\n\r\ncue content\r\n',
    );
  });

  test('does not modify content without a WEBVTT header', () => {
    const input = 'not a vtt file\n';
    expect(injectTimestampMap(input)).toBe(input);
  });

  test('only modifies the first line', () => {
    const input =
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nWEBVTT trick line\n';
    const result = injectTimestampMap(input);
    // Only the leading WEBVTT header gets the injection, not any later occurrences
    expect(result.split('X-TIMESTAMP-MAP')).toHaveLength(2);
  });
});
