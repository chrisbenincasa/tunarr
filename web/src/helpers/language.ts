import languages from '@cospired/i18n-iso-languages';
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
