import languages from '@cospired/i18n-iso-languages';
import en from '@cospired/i18n-iso-languages/langs/en.json';
import { seq } from '@tunarr/shared/util';
import type { LanguagePreference } from '@tunarr/types';
import { entries, sortBy } from 'lodash-es';

// Initialize the languages database with English names
languages.registerLocale(en);

export const languageOptions = sortBy(
  seq.collect(entries(languages.getNames('en')), ([code, name]) => {
    const iso6392 = languages.alpha2ToAlpha3B(code);
    if (!iso6392) {
      return;
    }
    return {
      iso6391: code,
      iso6392,
      displayName: name,
    } satisfies LanguagePreference;
  }),
  (opt) => opt.displayName,
);

export const useLanguageOptions = () => {
  return languageOptions;
};
