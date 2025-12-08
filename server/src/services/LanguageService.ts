import languages from '@cospired/i18n-iso-languages';
import { injectable } from 'inversify';

@injectable()
export class LanguageService {
  static Known3BCodes: Set<string>;
  static Known3TCodes: Set<string>;
  static Known2Codes: Set<string>;

  static {
    this.Known2Codes = new Set(Object.keys(languages.getAlpha2Codes()));
    this.Known3BCodes = new Set(Object.keys(languages.getAlpha3BCodes()));
    this.Known3TCodes = new Set(Object.keys(languages.getAlpha3TCodes()));
  }

  static isValidLanguageCode(code: string) {
    return languages.isValid(code);
  }

  static getAlpha3TCode(input: string) {
    input = input.toLowerCase().trim();
    if (this.Known3TCodes.has(input)) {
      return input;
    }

    if (this.Known3BCodes.has(input)) {
      const alpha2 = languages.alpha3TToAlpha2(input);
      if (alpha2) {
        return languages.alpha2ToAlpha3T(alpha2);
      }
    }

    if (this.Known2Codes.has(input)) {
      return languages.alpha2ToAlpha3T(input);
    }

    return;
  }
}
