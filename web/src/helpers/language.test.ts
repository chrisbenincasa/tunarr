import languages from '@cospired/i18n-iso-languages';
import { describe, expect, it } from 'vitest';
import { languageBy3LetterCode } from './language.ts';
import { languageOptions } from '../hooks/useLanguagePreferences.ts';

// ISO 639-2 gives 20 languages two 3-letter codes: a bibliographic (/B) code
// and a terminological (/T) code. The server normalizes stream tags to /T, so
// the preference pickers must emit /T too, and display lookups must tolerate
// values already stored in either set.
// Regression test for https://github.com/chrisbenincasa/tunarr/issues/1960
describe('language options', () => {
  it('emits ISO 639-2/T codes', () => {
    const german = languageOptions.find((opt) => opt.iso6391 === 'de');
    expect(german?.iso6392).toBe('deu');

    const french = languageOptions.find((opt) => opt.iso6391 === 'fr');
    expect(french?.iso6392).toBe('fra');
  });

  it('agrees with the code set the subtitle picker emits', () => {
    // LanguageAutocomplete builds its options with alpha2ToAlpha3T; the two
    // pickers must not disagree or preferences saved in one screen will not
    // match the other.
    for (const { iso6391, iso6392 } of languageOptions) {
      expect(iso6392).toBe(languages.alpha2ToAlpha3T(iso6391));
    }
  });
});

describe('languageBy3LetterCode', () => {
  it('resolves display names for ISO 639-2/T codes', () => {
    expect(languageBy3LetterCode['deu']).toBe('German');
    expect(languageBy3LetterCode['fra']).toBe('French');
    expect(languageBy3LetterCode['eng']).toBe('English');
  });

  it('resolves display names for legacy ISO 639-2/B codes', () => {
    // Preferences saved before the pickers agreed on /T are still in the DB.
    expect(languageBy3LetterCode['ger']).toBe('German');
    expect(languageBy3LetterCode['fre']).toBe('French');
    expect(languageBy3LetterCode['dut']).toBe('Dutch');
  });
});
