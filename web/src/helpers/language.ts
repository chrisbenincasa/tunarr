import languages from '@cospired/i18n-iso-languages';
import type { LanguagePreference } from '@tunarr/types';
import { languageOptions } from '../hooks/useLanguagePreferences.ts';

// TODO localize
export const languageBy3LetterCode = (function () {
  const lang: Record<string, string> = {};
  for (const { iso6391, iso6392, displayName } of languageOptions) {
    lang[iso6392] = displayName;
    // ISO 639-2 gives 20 languages a second, bibliographic code ("ger" for
    // German). Preferences saved before the pickers standardized on the
    // terminological code are still stored that way, so index both.
    const bibliographic = languages.alpha2ToAlpha3B(iso6391);
    if (bibliographic) {
      lang[bibliographic] = displayName;
    }
  }
  return lang;
})();

const CUSTOM_LANGUAGE_CODE = /^[a-z]{2,3}$/;

/**
 * Comparison key for a stored code. ISO 639-1, 639-2/B, and 639-2/T codes for
 * the same language share a key, and unknown codes compare case-insensitively.
 */
export function languageKey(code: string): string {
  const lower = code.trim().toLowerCase();
  return languages.toAlpha3T(lower) ?? lower;
}

export function languageDisplayName(code: string): string | undefined {
  return languageBy3LetterCode[languageKey(code)];
}

/**
 * Turns typed input into a code to store. Known codes and English language
 * names become ISO 639-2/T. Other 2- or 3-letter input stays as a custom code,
 * and anything else returns undefined.
 */
export function parseLanguageInput(input: string): string | undefined {
  const value = input.trim().toLowerCase();
  const known = languages.toAlpha3T(value);
  if (known) {
    return known;
  }

  const byName = languageOptions.find(
    (opt) => opt.displayName.toLowerCase() === value,
  );
  if (byName) {
    return byName.iso6392;
  }

  return CUSTOM_LANGUAGE_CODE.test(value) ? value : undefined;
}

/**
 * Filters picker options by name, and lists an option whose code matches the
 * query exactly first, so typing "en" highlights English before Armenian.
 *
 * Options already chosen are absent from `options`. If the query is the code
 * of one of those, nothing matches, so the picker doesn't highlight a
 * different language that merely contains the letters.
 */
export function filterLanguageOptions<T extends LanguagePreference>(
  options: T[],
  query: string,
): T[] {
  const value = query.trim().toLowerCase();
  if (!value) {
    return options;
  }

  const code = languages.toAlpha3T(value);
  const exact = options.filter((opt) => opt.iso6392 === code);
  if (code && exact.length === 0) {
    return [];
  }
  const byName = options.filter(
    (opt) =>
      opt.iso6392 !== code && opt.displayName.toLowerCase().includes(value),
  );
  return [...exact, ...byName];
}
