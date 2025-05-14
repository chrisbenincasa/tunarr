import languages from '@cospired/i18n-iso-languages/index';
import { seq } from '@tunarr/shared/util';
import { entries, sortBy } from 'lodash-es';

export const languageOptions = sortBy(
  seq.collect(entries(languages.getNames('en')), ([iso6391, name]) => {
    const iso6392 = languages.alpha2ToAlpha3B(iso6391);
    if (!iso6392) {
      return;
    }
    return {
      iso6391,
      iso6392,
      label: name,
    };
  }),
  (opt) => opt.label,
);

// TODO localize
export const languageBy3LetterCode = (function () {
  const lang: Record<string, string> = {};
  for (const { iso6392, label } of languageOptions) {
    lang[iso6392] = label;
  }
  return lang;
})();
