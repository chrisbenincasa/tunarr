import { describe, expect, test } from 'vitest';
import { parseEncoderLeadFromFramecrc } from './MeasureAudioEncoderLeadTask.js';

const header = [
  '#tb 0: 1/48000',
  '#media_type 0: audio',
  '#codec_id 0: aac',
  '#sample_rate 0: 48000',
];

describe('parseEncoderLeadFromFramecrc', () => {
  test('converts the first packet lead to 90 kHz ticks', () => {
    // AAC primes 1024 samples, which is 1920 ticks at 48 kHz.
    const output = [
      ...header,
      '0,     478976,     478976,     1024,      6, 0x05f1011b',
      '0,     480000,     480000,     1024,      6, 0x05f1011b',
    ].join('\n');

    expect(parseEncoderLeadFromFramecrc(output, 10)).toBe(1920);
  });

  test('rounds a fractional lead up so audio never overlaps', () => {
    // libmp3lame delays 1105 samples, which is 2071.875 ticks.
    const output = [
      ...header,
      '0,     478895,     478895,     1152,      384, 0xd37377c1, S=1,       10',
    ].join('\n');

    expect(parseEncoderLeadFromFramecrc(output, 10)).toBe(2072);
  });

  test('returns zero for an encoder without delay', () => {
    const output = [
      ...header,
      '0,     480000,     480000,     1024,  4096, 0x0',
    ].join('\n');

    expect(parseEncoderLeadFromFramecrc(output, 10)).toBe(0);
  });

  test('rejects an implausible lead', () => {
    const output = [
      ...header,
      '0,     240000,     240000,     1024,  6, 0x0',
    ].join('\n');

    expect(() => parseEncoderLeadFromFramecrc(output, 10)).toThrow(
      /Implausible audio encoder lead/,
    );
  });

  test('throws when there are no packets', () => {
    expect(() => parseEncoderLeadFromFramecrc(header.join('\n'), 10)).toThrow(
      /no audio packets/,
    );
  });
});
