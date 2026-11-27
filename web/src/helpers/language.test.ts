import languages from '@cospired/i18n-iso-languages';
import { describe, expect, it } from 'vitest';
import {
  filterLanguageOptions,
  languageBy3LetterCode,
  languageDisplayName,
  languageKey,
  parseLanguageInput,
} from './language.ts';
import { languageOptions } from '../hooks/useLanguagePreferences.ts';
import { moveItem, moveOnDragOver } from './util.ts';

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

describe('languageKey', () => {
  it('gives every code for a language the same key', () => {
    expect(languageKey('de')).toBe('deu');
    expect(languageKey('ger')).toBe('deu');
    expect(languageKey('DEU')).toBe('deu');
  });

  it('lowercases unknown codes', () => {
    expect(languageKey('QAA')).toBe('qaa');
  });
});

describe('languageDisplayName', () => {
  it('names known codes and leaves unknown ones undefined', () => {
    expect(languageDisplayName('jpn')).toBe('Japanese');
    expect(languageDisplayName('en')).toBe('English');
    expect(languageDisplayName('qaa')).toBeUndefined();
  });
});

describe('parseLanguageInput', () => {
  it('turns known codes into ISO 639-2/T', () => {
    expect(parseLanguageInput('en')).toBe('eng');
    expect(parseLanguageInput(' GER ')).toBe('deu');
    expect(parseLanguageInput('fra')).toBe('fra');
  });

  it('accepts an English language name', () => {
    expect(parseLanguageInput('Japanese')).toBe('jpn');
  });

  it('keeps other 2- or 3-letter input as a custom code', () => {
    expect(parseLanguageInput('QAA')).toBe('qaa');
  });

  it('rejects input that is neither a name nor a code', () => {
    expect(parseLanguageInput('japan')).toBeUndefined();
    expect(parseLanguageInput('')).toBeUndefined();
    expect(parseLanguageInput('e1')).toBeUndefined();
  });
});

describe('filterLanguageOptions', () => {
  it('lists the exact code match before name matches', () => {
    const names = filterLanguageOptions(languageOptions, 'en').map(
      (opt) => opt.displayName,
    );
    expect(names[0]).toBe('English');
    expect(names).toContain('Armenian');
  });

  it('matches nothing when the code belongs to a language already chosen', () => {
    const withoutEnglish = languageOptions.filter(
      (opt) => opt.iso6392 !== 'eng',
    );
    expect(filterLanguageOptions(withoutEnglish, 'en')).toEqual([]);
  });

  it('returns every option for an empty query', () => {
    expect(filterLanguageOptions(languageOptions, '  ')).toBe(languageOptions);
  });
});

describe('moveItem', () => {
  it('moves an item down and up without changing the input', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('moveOnDragOver', () => {
  const items = ['a', 'b', 'c'];

  it('moves once the pointer crosses the middle of the hovered item', () => {
    expect(moveOnDragOver(items, 'a', 'b', false)).toEqual(['b', 'a', 'c']);
    expect(moveOnDragOver(items, 'c', 'a', true)).toEqual(['c', 'a', 'b']);
  });

  it('waits while the pointer is on the near half of the hovered item', () => {
    expect(moveOnDragOver(items, 'a', 'b', true)).toBeUndefined();
    expect(moveOnDragOver(items, 'c', 'a', false)).toBeUndefined();
  });

  it('ignores an item hovering over itself or a missing item', () => {
    expect(moveOnDragOver(items, 'a', 'a', true)).toBeUndefined();
    expect(moveOnDragOver(items, 'z', 'a', true)).toBeUndefined();
  });
});
