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
      const alpha2 = languages.alpha3BToAlpha2(input);
      if (alpha2) {
        return languages.alpha2ToAlpha3T(alpha2);
      }
    }

    if (this.Known2Codes.has(input)) {
      return languages.alpha2ToAlpha3T(input);
    }

    return;
  }

  /**
   * Normalize any language identifier (ISO 639-1, 639-2/B, 639-2/T, or
   * English name) to its ISO 639-2/T (Alpha-3 T) code.
   *
   * Returns undefined when the input cannot be resolved.
   */
  static normalizeToAlpha3T(input: string): string | undefined {
    // Try as ISO code first (2-letter, 3-letter B/T)
    const fromCode = this.getAlpha3TCode(input);
    if (fromCode !== undefined) {
      return fromCode;
    }

    // Try as English language name (e.g., "Japanese" → "jpn")
    const fromName = languages.getAlpha3TCode(input, 'en');
    if (fromName) {
      return fromName;
    }

    return undefined;
  }

  /**
   * Compare two language identifiers for equivalence.
   *
   * ISO 639-2 assigns 20 languages both a bibliographic (/B) and a
   * terminological (/T) code — German is "ger" and "deu" — and media servers,
   * containers and users pick between them freely. Both sides are normalized
   * to /T before comparison so the two code sets are interchangeable.
   *
   * Falls back to a case-insensitive exact comparison when either side cannot
   * be resolved, which keeps private-use codes (e.g. "qaa") working.
   */
  static codesMatch(a: string | undefined, b: string | undefined): boolean {
    if (a === undefined || b === undefined) {
      return false;
    }

    const aLower = a.toLowerCase().trim();
    const bLower = b.toLowerCase().trim();
    if (aLower === bLower) {
      return true;
    }

    const aNormalized = this.normalizeToAlpha3T(aLower);
    if (aNormalized === undefined) {
      return false;
    }

    return aNormalized === this.normalizeToAlpha3T(bLower);
  }
}
