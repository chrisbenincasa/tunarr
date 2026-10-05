import languages from '@cospired/i18n-iso-languages';
import en from '@cospired/i18n-iso-languages/langs/en.json' with { type: 'json' };
import { beforeAll, describe, expect, it } from 'vitest';
import { LanguageService } from './LanguageService.ts';

// Mirrors bootstrap.ts, which registers the English locale at startup.
beforeAll(() => {
  languages.registerLocale(en);
});

// ISO 639-2 defines two code sets for 20 languages: a bibliographic (/B) code
// derived from the English name and a terminological (/T) code derived from the
// native name. Media containers and servers use them interchangeably.
const BIBLIOGRAPHIC_TO_TERMINOLOGICAL = [
  ['ger', 'deu'],
  ['fre', 'fra'],
  ['chi', 'zho'],
  ['cze', 'ces'],
  ['dut', 'nld'],
  ['gre', 'ell'],
  ['ice', 'isl'],
  ['mac', 'mkd'],
  ['may', 'msa'],
  ['per', 'fas'],
  ['rum', 'ron'],
  ['slo', 'slk'],
  ['alb', 'sqi'],
  ['arm', 'hye'],
  ['baq', 'eus'],
  ['bur', 'mya'],
  ['geo', 'kat'],
  ['mao', 'mri'],
  ['tib', 'bod'],
  ['wel', 'cym'],
] as const;

describe('LanguageService', () => {
  describe('getAlpha3TCode', () => {
    it.each(BIBLIOGRAPHIC_TO_TERMINOLOGICAL)(
      'normalizes the ISO 639-2/B code %s to the /T code %s',
      (bibliographic, terminological) => {
        expect(LanguageService.getAlpha3TCode(bibliographic)).toBe(
          terminological,
        );
      },
    );

    it.each(BIBLIOGRAPHIC_TO_TERMINOLOGICAL)(
      'passes the ISO 639-2/T code %s through unchanged',
      (_bibliographic, terminological) => {
        expect(LanguageService.getAlpha3TCode(terminological)).toBe(
          terminological,
        );
      },
    );

    it('normalizes ISO 639-1 codes to /T', () => {
      expect(LanguageService.getAlpha3TCode('de')).toBe('deu');
      expect(LanguageService.getAlpha3TCode('en')).toBe('eng');
    });

    it('is case and whitespace insensitive', () => {
      expect(LanguageService.getAlpha3TCode(' GER ')).toBe('deu');
      expect(LanguageService.getAlpha3TCode('Deu')).toBe('deu');
    });

    it('leaves codes with a single ISO 639-2 representation alone', () => {
      expect(LanguageService.getAlpha3TCode('eng')).toBe('eng');
      expect(LanguageService.getAlpha3TCode('jpn')).toBe('jpn');
      expect(LanguageService.getAlpha3TCode('spa')).toBe('spa');
    });

    it('returns undefined for unknown codes', () => {
      expect(LanguageService.getAlpha3TCode('zzz')).toBeUndefined();
      expect(LanguageService.getAlpha3TCode('')).toBeUndefined();
    });
  });

  describe('normalizeToAlpha3T', () => {
    it('normalizes bibliographic codes', () => {
      expect(LanguageService.normalizeToAlpha3T('ger')).toBe('deu');
      expect(LanguageService.normalizeToAlpha3T('fre')).toBe('fra');
    });

    it('normalizes English language names', () => {
      expect(LanguageService.normalizeToAlpha3T('German')).toBe('deu');
      expect(LanguageService.normalizeToAlpha3T('Japanese')).toBe('jpn');
    });

    it('returns undefined for unresolvable input', () => {
      expect(LanguageService.normalizeToAlpha3T('Klingon')).toBeUndefined();
    });
  });

  describe('codesMatch', () => {
    it.each(BIBLIOGRAPHIC_TO_TERMINOLOGICAL)(
      'treats %s and %s as the same language',
      (bibliographic, terminological) => {
        expect(LanguageService.codesMatch(bibliographic, terminological)).toBe(
          true,
        );
        expect(LanguageService.codesMatch(terminological, bibliographic)).toBe(
          true,
        );
      },
    );

    it('matches identical codes', () => {
      expect(LanguageService.codesMatch('eng', 'eng')).toBe(true);
      expect(LanguageService.codesMatch('jpn', 'jpn')).toBe(true);
    });

    it('matches across ISO 639-1 and ISO 639-2', () => {
      expect(LanguageService.codesMatch('de', 'ger')).toBe(true);
      expect(LanguageService.codesMatch('de', 'deu')).toBe(true);
      expect(LanguageService.codesMatch('en', 'eng')).toBe(true);
    });

    it('matches an English name against a code', () => {
      expect(LanguageService.codesMatch('German', 'deu')).toBe(true);
      expect(LanguageService.codesMatch('German', 'ger')).toBe(true);
    });

    it('is case and whitespace insensitive', () => {
      expect(LanguageService.codesMatch(' GER ', 'Deu')).toBe(true);
    });

    it('does not match different languages', () => {
      expect(LanguageService.codesMatch('ger', 'eng')).toBe(false);
      expect(LanguageService.codesMatch('deu', 'nld')).toBe(false);
      expect(LanguageService.codesMatch('dut', 'deu')).toBe(false);
    });

    it('falls back to exact comparison for unresolvable codes', () => {
      expect(LanguageService.codesMatch('qaa', 'qaa')).toBe(true);
      expect(LanguageService.codesMatch('qaa', 'qab')).toBe(false);
      expect(LanguageService.codesMatch('und', 'eng')).toBe(false);
    });

    it('never matches when either side is undefined', () => {
      expect(LanguageService.codesMatch(undefined, 'eng')).toBe(false);
      expect(LanguageService.codesMatch('eng', undefined)).toBe(false);
      expect(LanguageService.codesMatch(undefined, undefined)).toBe(false);
    });
  });
});
