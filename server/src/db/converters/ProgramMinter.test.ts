import { describe, expect, it } from 'vitest';
import { LanguageService } from '@/services/LanguageService.js';

// The ISO 639-2 /B→/T normalization that keeps stored language codes in one
// canonical set. Regression coverage for #2044: a provider's bibliographic
// code must turn into the terminological code Tunarr stores elsewhere
// (FfprobeStreamDetails / LocalSubtitlesService already write /T), and an
// unresolvable value must be kept as-is rather than dropped.
describe('LanguageService.normalizeLanguageCode (#2044)', () => {
  it.each([
    // /B → /T (the reported class: German 'ger' vs 'deu')
    ['ger', 'deu'],
    ['fre', 'fra'],
    ['dut', 'nld'],
    ['chi', 'zho'],
  ])('maps ISO 639-2/B "%s" to its /T equivalent "%s"', (input, expected) => {
    expect(LanguageService.normalizeLanguageCode(input)).toBe(expected);
  });

  it.each(['deu', 'fra', 'nld', 'por', 'jpn', 'eng'])(
    'keeps an already-/T code "%s" unchanged',
    (input) => {
      expect(LanguageService.normalizeLanguageCode(input)).toBe(input);
    },
  );

  it.each(['de', 'fr', 'nl', 'pt', 'ja'])(
    'maps a 2-letter code "%s" to its /T code',
    (input) => {
      const out = LanguageService.normalizeLanguageCode(input);
      expect(out).toBeDefined();
      expect(out).toHaveLength(3);
    },
  );

  it('maps an English language name to its /T code', () => {
    expect(LanguageService.normalizeLanguageCode('japanese')).toBe('jpn');
    expect(LanguageService.normalizeLanguageCode('German')).toBe('deu');
  });

  it.each(['unknown', 'xxyy', 'abc123'])(
    'keeps an unresolvable value "%s" verbatim (incl. the subtitle sentinel)',
    (input) => {
      expect(LanguageService.normalizeLanguageCode(input)).toBe(input);
    },
  );

  it('passes through an empty or absent value', () => {
    expect(LanguageService.normalizeLanguageCode(undefined)).toBeUndefined();
    expect(LanguageService.normalizeLanguageCode('')).toBe('');
  });

  it('coerces a null code to undefined', () => {
    // Plex/Emby subtitle language fields are nullable; the function must not
    // blow up and must return undefined so callers can fall back to their
    // default (e.g. ?? 'unknown').
    expect(LanguageService.normalizeLanguageCode(null)).toBeUndefined();
  });
});
