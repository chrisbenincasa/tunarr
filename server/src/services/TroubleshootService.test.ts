import { describe, expect, it } from 'vitest';
import type { SubtitleStreamDetails } from '../stream/types.ts';
import { findSubtitleForLanguages } from './TroubleshootService.ts';

function makeSubtitle(
  index: number,
  languageCodeISO6392: string,
): SubtitleStreamDetails {
  return {
    type: 'embedded',
    codec: 'subrip',
    index,
    default: false,
    forced: false,
    sdh: false,
    languageCodeISO6392,
  };
}

// The troubleshoot report is the tool users copy into bug reports, so its
// subtitle matching has to agree with what playback actually picks. It used to
// compare codes as raw strings while the stream selector normalized them.
// Regression test for https://github.com/chrisbenincasa/tunarr/issues/1960
describe('findSubtitleForLanguages', () => {
  it('matches a bibliographic request against a terminological stream', () => {
    const match = findSubtitleForLanguages(
      [makeSubtitle(1, 'deu'), makeSubtitle(2, 'eng')],
      ['ger'],
    );

    expect(match?.stream.index).toBe(1);
    expect(match?.language).toBe('ger');
  });

  it('matches a terminological request against a bibliographic stream', () => {
    const match = findSubtitleForLanguages(
      [makeSubtitle(1, 'ger'), makeSubtitle(2, 'eng')],
      ['deu'],
    );

    expect(match?.stream.index).toBe(1);
  });

  it('honors request order', () => {
    const match = findSubtitleForLanguages(
      [makeSubtitle(1, 'deu'), makeSubtitle(2, 'eng')],
      ['eng', 'ger'],
    );

    expect(match?.stream.index).toBe(2);
    expect(match?.language).toBe('eng');
  });

  it('returns undefined when nothing matches', () => {
    expect(
      findSubtitleForLanguages([makeSubtitle(1, 'eng')], ['ger']),
    ).toBeUndefined();
  });

  it('returns undefined when there are no subtitle streams', () => {
    expect(findSubtitleForLanguages(undefined, ['ger'])).toBeUndefined();
    expect(findSubtitleForLanguages([], ['ger'])).toBeUndefined();
  });
});
