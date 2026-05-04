import { describe, expect, it } from 'vitest';
import type { StreamSelectionCelContext } from './CelEvaluationService.ts';
import {
  CelEvaluationService,
  CelEvaluationError,
} from './CelEvaluationService.ts';

function makeContext(
  overrides: Partial<StreamSelectionCelContext> = {},
): StreamSelectionCelContext {
  return {
    audio: {
      streams: [
        {
          index: 0,
          language: 'eng',
          codec: 'aac',
          channels: 6,
          title: 'Surround 5.1',
          default: true,
          selected: true,
        },
        {
          index: 1,
          language: 'jpn',
          codec: 'aac',
          channels: 2,
          title: 'Japanese Stereo',
          default: false,
          selected: false,
        },
      ],
      languages: ['eng', 'jpn'],
    },
    subtitle: {
      streams: [
        {
          index: 2,
          language: 'eng',
          codec: 'srt',
          type: 'embedded',
          title: 'English',
          default: true,
          forced: false,
          sdh: false,
        },
      ],
      languages: ['eng'],
    },
    channel: { name: 'Movies', number: 5 },
    program: { title: 'The Matrix', type: 'movie' },
    ...overrides,
  };
}

describe('CelEvaluationService', () => {
  const service = new CelEvaluationService();

  describe('evaluate', () => {
    it('evaluates a simple true expression', () => {
      const ctx = makeContext();
      expect(service.evaluate('true', ctx)).toBe(true);
    });

    it('evaluates a simple false expression', () => {
      const ctx = makeContext();
      expect(service.evaluate('false', ctx)).toBe(false);
    });

    it('evaluates channel name equality', () => {
      const ctx = makeContext();
      expect(service.evaluate('channel.name == "Movies"', ctx)).toBe(true);
      expect(service.evaluate('channel.name == "Sports"', ctx)).toBe(false);
    });

    it('evaluates channel number comparison', () => {
      const ctx = makeContext();
      expect(service.evaluate('channel.number == 5', ctx)).toBe(true);
      expect(service.evaluate('channel.number > 3', ctx)).toBe(true);
      expect(service.evaluate('channel.number < 3', ctx)).toBe(false);
    });

    it('evaluates program fields', () => {
      const ctx = makeContext();
      expect(service.evaluate('program.title == "The Matrix"', ctx)).toBe(true);
      expect(service.evaluate('program.type == "movie"', ctx)).toBe(true);
    });

    it('evaluates audio.languages contains check', () => {
      const ctx = makeContext();
      expect(service.evaluate('"eng" in audio.languages', ctx)).toBe(true);
      expect(service.evaluate('"fra" in audio.languages', ctx)).toBe(false);
    });

    it('evaluates subtitle.languages contains check', () => {
      const ctx = makeContext();
      expect(service.evaluate('"eng" in subtitle.languages', ctx)).toBe(true);
      expect(service.evaluate('"jpn" in subtitle.languages', ctx)).toBe(false);
    });

    it('evaluates logical AND', () => {
      const ctx = makeContext();
      expect(
        service.evaluate('channel.number == 5 && program.type == "movie"', ctx),
      ).toBe(true);
      expect(
        service.evaluate('channel.number == 5 && program.type == "show"', ctx),
      ).toBe(false);
    });

    it('evaluates logical OR', () => {
      const ctx = makeContext();
      expect(
        service.evaluate(
          'channel.number == 99 || program.type == "movie"',
          ctx,
        ),
      ).toBe(true);
    });

    it('evaluates negation', () => {
      const ctx = makeContext();
      expect(service.evaluate('!(channel.number == 99)', ctx)).toBe(true);
    });

    it('returns false for invalid expressions', () => {
      const ctx = makeContext();
      // Invalid expression should not throw, returns false
      expect(service.evaluate('this is not valid CEL!!!', ctx)).toBe(false);
    });

    it('returns false when expression evaluates to non-boolean', () => {
      const ctx = makeContext();
      // channel.name is a string, not boolean — Zod parse should fail
      expect(service.evaluate('channel.name', ctx)).toBe(false);
    });

    it('evaluates size of audio streams list', () => {
      const ctx = makeContext();
      expect(service.evaluate('size(audio.streams) == 2', ctx)).toBe(true);
      expect(service.evaluate('size(audio.streams) > 1', ctx)).toBe(true);
    });

    it('evaluates size of subtitle streams list', () => {
      const ctx = makeContext();
      expect(service.evaluate('size(subtitle.streams) == 1', ctx)).toBe(true);
    });

    it('evaluates empty subtitle streams', () => {
      const ctx = makeContext({
        subtitle: { streams: [], languages: [] },
      });
      expect(service.evaluate('size(subtitle.streams) == 0', ctx)).toBe(true);
    });
  });

  describe('custom functions', () => {
    describe('hasAudioLang', () => {
      it('matches ISO 639-2/T code directly', () => {
        const ctx = makeContext();
        expect(service.evaluate('hasAudioLang("eng")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("jpn")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("fra")', ctx)).toBe(false);
      });

      it('matches ISO 639-1 code via normalization', () => {
        const ctx = makeContext();
        expect(service.evaluate('hasAudioLang("en")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("ja")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("fr")', ctx)).toBe(false);
      });

      it('matches English language name', () => {
        const ctx = makeContext();
        expect(service.evaluate('hasAudioLang("English")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("Japanese")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("French")', ctx)).toBe(false);
      });

      it('falls back to case-insensitive match for unknown inputs', () => {
        const ctx = makeContext({
          audio: {
            streams: [
              {
                index: 0,
                language: 'und',
                codec: 'aac',
                channels: 2,
                title: '',
                default: true,
                selected: true,
              },
            ],
            languages: ['und'],
          },
        });
        expect(service.evaluate('hasAudioLang("und")', ctx)).toBe(true);
        expect(service.evaluate('hasAudioLang("UND")', ctx)).toBe(true);
      });
    });

    describe('hasSubtitleLang', () => {
      it('matches subtitle languages with normalization', () => {
        const ctx = makeContext();
        expect(service.evaluate('hasSubtitleLang("eng")', ctx)).toBe(true);
        expect(service.evaluate('hasSubtitleLang("en")', ctx)).toBe(true);
        expect(service.evaluate('hasSubtitleLang("English")', ctx)).toBe(true);
        expect(service.evaluate('hasSubtitleLang("jpn")', ctx)).toBe(false);
      });
    });

    describe('hasLang', () => {
      it('matches audio or subtitle languages', () => {
        const ctx = makeContext();
        // "eng" is in both audio and subtitle
        expect(service.evaluate('hasLang("eng")', ctx)).toBe(true);
        // "jpn" is only in audio
        expect(service.evaluate('hasLang("jpn")', ctx)).toBe(true);
        // "fra" is in neither
        expect(service.evaluate('hasLang("fra")', ctx)).toBe(false);
      });

      it('matches when only subtitles have the language', () => {
        const ctx = makeContext({
          audio: {
            streams: [
              {
                index: 0,
                language: 'jpn',
                codec: 'aac',
                channels: 2,
                title: '',
                default: true,
                selected: true,
              },
            ],
            languages: ['jpn'],
          },
        });
        // "eng" only exists in subtitle.languages
        expect(service.evaluate('hasLang("eng")', ctx)).toBe(true);
      });
    });

    describe('isMultiLanguage', () => {
      it('returns true when audio has multiple languages', () => {
        const ctx = makeContext();
        expect(service.evaluate('isMultiLanguage()', ctx)).toBe(true);
      });

      it('returns false when audio has one language', () => {
        const ctx = makeContext({
          audio: {
            streams: [
              {
                index: 0,
                language: 'eng',
                codec: 'aac',
                channels: 6,
                title: 'Surround',
                default: true,
                selected: true,
              },
              {
                index: 1,
                language: 'eng',
                codec: 'aac',
                channels: 2,
                title: 'Stereo',
                default: false,
                selected: false,
              },
            ],
            languages: ['eng'],
          },
        });
        expect(service.evaluate('isMultiLanguage()', ctx)).toBe(false);
      });

      it('returns false when audio has no languages', () => {
        const ctx = makeContext({
          audio: { streams: [], languages: [] },
        });
        expect(service.evaluate('isMultiLanguage()', ctx)).toBe(false);
      });

      it('deduplicates equivalent codes', () => {
        // "eng" and "en" should normalize to the same code
        const ctx = makeContext({
          audio: {
            streams: [],
            languages: ['eng', 'en'],
          },
        });
        expect(service.evaluate('isMultiLanguage()', ctx)).toBe(false);
      });
    });

    describe('composability', () => {
      it('combines custom functions with standard CEL operators', () => {
        const ctx = makeContext();
        expect(
          service.evaluate('isMultiLanguage() && hasAudioLang("jpn")', ctx),
        ).toBe(true);
        expect(
          service.evaluate('isMultiLanguage() && hasAudioLang("fra")', ctx),
        ).toBe(false);
      });

      it('combines custom functions with context fields', () => {
        const ctx = makeContext();
        expect(
          service.evaluate(
            'hasAudioLang("jpn") && program.type == "movie"',
            ctx,
          ),
        ).toBe(true);
      });
    });
  });

  describe('validate', () => {
    it('returns undefined for valid expressions', () => {
      expect(service.validate('true')).toBeUndefined();
      expect(service.validate('channel.name == "Test"')).toBeUndefined();
      expect(service.validate('"eng" in audio.languages')).toBeUndefined();
      expect(
        service.validate('channel.number > 5 && program.type == "movie"'),
      ).toBeUndefined();
    });

    it('returns CelEvaluationError for invalid expressions', () => {
      const result = service.validate('this is not valid {{}}');
      expect(result).toBeInstanceOf(CelEvaluationError);
    });

    it('returns CelEvaluationError for unclosed strings', () => {
      const result = service.validate('"unclosed string');
      expect(result).toBeInstanceOf(CelEvaluationError);
    });

    it('returns CelEvaluationError for unbalanced parens', () => {
      const result = service.validate('((true)');
      expect(result).toBeInstanceOf(CelEvaluationError);
    });
  });
});
