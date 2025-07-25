import { languageOptions } from '../hooks/useLanguagePreferences.ts';

// TODO localize
export const languageBy3LetterCode = (function () {
  const lang: Record<string, string> = {};
  for (const { iso6392, displayName } of languageOptions) {
    lang[iso6392] = displayName;
  }
  return lang;
})();
