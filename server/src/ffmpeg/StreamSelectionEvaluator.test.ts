import type {
  StreamSelectionProfile,
  StreamSelectionRule,
} from '@tunarr/types/schemas';
import type { NonEmptyArray } from 'ts-essentials';
import { describe, expect, it, vi } from 'vitest';
import type {
  AudioStreamDetails,
  SubtitleStreamDetails,
} from '../stream/types.ts';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { StreamSelectionCelContext } from '../services/CelEvaluationService.ts';
import {
  buildCelContext,
  evaluateStreamSelectionProfile,
  evaluateSubtitleSelection,
  resolveAudioAction,
} from './StreamSelectionEvaluator.ts';

// Mock SubtitleStreamPicker so we don't hit the filesystem
vi.mock('./SubtitleStreamPicker.ts', () => ({
  SubtitleStreamPicker: {
    getSubtitleDetailsWithExtractedPath: vi
      .fn()
      .mockImplementation(
        (
          _lineupItem: ContentBackedStreamLineupItem,
          stream: SubtitleStreamDetails,
        ) => Promise.resolve({ ...stream, path: '/fake/path.vtt' }),
      ),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAudioStream(
  overrides: Partial<AudioStreamDetails> & { index: number },
): AudioStreamDetails {
  return {
    channels: 2,
    codec: 'aac',
    default: false,
    selected: false,
    language: 'English',
    languageCodeISO6391: 'en',
    languageCodeISO6392: 'eng',
    ...overrides,
  };
}

function makeSubtitleStream(
  overrides: Partial<SubtitleStreamDetails> & { index: number },
): SubtitleStreamDetails {
  return {
    type: 'embedded',
    codec: 'srt',
    default: false,
    forced: false,
    sdh: false,
    language: 'English',
    languageCodeISO6391: 'en',
    languageCodeISO6392: 'eng',
    ...overrides,
  };
}

function makeLineupItem(): ContentBackedStreamLineupItem {
  return {
    type: 'program',
    program: {
      uuid: 'prog-1',
      externalKey: 'ext-1',
      mediaSourceId: 'src-1',
      sourceType: 'plex',
    },
  } as unknown as ContentBackedStreamLineupItem;
}

function makeCelService(evaluateResult: boolean | ((expr: string) => boolean)) {
  const evalFn =
    typeof evaluateResult === 'function'
      ? evaluateResult
      : () => evaluateResult;
  return {
    evaluate: vi.fn().mockImplementation(evalFn),
    validate: vi.fn().mockReturnValue(undefined),
    logger: {} as never,
  };
}

function makeProfile(rules: StreamSelectionRule[]): StreamSelectionProfile {
  return {
    uuid: 'profile-1',
    name: 'Test Profile',
    rules,
  };
}

function makeRule(
  overrides: Partial<StreamSelectionRule> = {},
): StreamSelectionRule {
  return {
    label: 'Test Rule',
    condition: 'true',
    audioAction: { type: 'default' },
    subtitleAction: { type: 'disable' },
    ...overrides,
  };
}

// ── buildCelContext ──────────────────────────────────────────────────────────

describe('buildCelContext', () => {
  const baseAudio: NonEmptyArray<AudioStreamDetails> = [
    makeAudioStream({ index: 0, languageCodeISO6392: 'eng', channels: 6 }),
    makeAudioStream({
      index: 1,
      languageCodeISO6392: 'jpn',
      language: 'Japanese',
      languageCodeISO6391: 'ja',
      channels: 2,
    }),
  ];

  const baseSubs: SubtitleStreamDetails[] = [
    makeSubtitleStream({ index: 2, languageCodeISO6392: 'eng', forced: true }),
    makeSubtitleStream({
      index: 3,
      languageCodeISO6392: 'spa',
      language: 'Spanish',
      languageCodeISO6391: 'es',
    }),
  ];

  const channel = { name: 'Movies', number: 5 };
  const program = { title: 'The Matrix', type: 'movie' };

  it('builds audio context with deduped languages', () => {
    const ctx = buildCelContext(baseAudio, baseSubs, channel, program);
    expect(ctx.audio.languages).toEqual(['eng', 'jpn']);
    expect(ctx.audio.streams).toHaveLength(2);
    expect(ctx.audio.streams[0]).toEqual({
      index: 0,
      language: 'eng',
      codec: 'aac',
      channels: 6,
      title: '',
      default: false,
      selected: false,
    });
  });

  it('builds subtitle context with deduped languages', () => {
    const ctx = buildCelContext(baseAudio, baseSubs, channel, program);
    expect(ctx.subtitle.languages).toEqual(['eng', 'spa']);
    expect(ctx.subtitle.streams).toHaveLength(2);
    expect(ctx.subtitle.streams[0]).toMatchObject({
      index: 2,
      language: 'eng',
      forced: true,
      default: false,
    });
  });

  it('handles undefined subtitle streams', () => {
    const ctx = buildCelContext(baseAudio, undefined, channel, program);
    expect(ctx.subtitle.streams).toEqual([]);
    expect(ctx.subtitle.languages).toEqual([]);
  });

  it('handles empty subtitle streams', () => {
    const ctx = buildCelContext(baseAudio, [], channel, program);
    expect(ctx.subtitle.streams).toEqual([]);
    expect(ctx.subtitle.languages).toEqual([]);
  });

  it('passes channel and program info through', () => {
    const ctx = buildCelContext(baseAudio, baseSubs, channel, program);
    expect(ctx.channel).toEqual({ name: 'Movies', number: 5 });
    expect(ctx.program).toEqual({ title: 'The Matrix', type: 'movie' });
  });

  it('falls back through language code priority (ISO6392 > ISO6391 > language)', () => {
    const audio: NonEmptyArray<AudioStreamDetails> = [
      makeAudioStream({
        index: 0,
        languageCodeISO6392: undefined,
        languageCodeISO6391: 'en',
        language: 'English',
      }),
    ];
    const ctx = buildCelContext(audio, undefined, channel, program);
    // For languages list: prefers ISO6392, then ISO6391
    expect(ctx.audio.languages).toEqual(['en']);
  });

  it('handles audio streams with no language info', () => {
    const audio: NonEmptyArray<AudioStreamDetails> = [
      makeAudioStream({
        index: 0,
        languageCodeISO6392: undefined,
        languageCodeISO6391: undefined,
        language: undefined,
      }),
    ];
    const ctx = buildCelContext(audio, undefined, channel, program);
    expect(ctx.audio.languages).toEqual([]);
    expect(ctx.audio.streams[0]!.language).toBe('');
  });

  it('deduplicates identical languages across streams', () => {
    const audio: NonEmptyArray<AudioStreamDetails> = [
      makeAudioStream({ index: 0, languageCodeISO6392: 'eng' }),
      makeAudioStream({ index: 1, languageCodeISO6392: 'eng', channels: 6 }),
    ];
    const ctx = buildCelContext(audio, undefined, channel, program);
    expect(ctx.audio.languages).toEqual(['eng']);
  });

  it('defaults optional numeric/boolean fields', () => {
    const audio: NonEmptyArray<AudioStreamDetails> = [
      { index: 0 }, // Minimal stream with no optional fields
    ];
    const ctx = buildCelContext(audio, undefined, channel, program);
    expect(ctx.audio.streams[0]).toEqual({
      index: 0,
      language: '',
      codec: '',
      channels: 0,
      title: '',
      default: false,
      selected: false,
    });
  });
});

// ── evaluateStreamSelectionProfile ──────────────────────────────────────────

describe('evaluateStreamSelectionProfile', () => {
  const audioStreams: NonEmptyArray<AudioStreamDetails> = [
    makeAudioStream({ index: 0, languageCodeISO6392: 'eng', channels: 2 }),
    makeAudioStream({
      index: 1,
      languageCodeISO6392: 'jpn',
      language: 'Japanese',
      languageCodeISO6391: 'ja',
      channels: 6,
    }),
  ];

  const subtitleStreams: SubtitleStreamDetails[] = [
    makeSubtitleStream({ index: 2, languageCodeISO6392: 'eng' }),
    makeSubtitleStream({
      index: 3,
      languageCodeISO6392: 'jpn',
      language: 'Japanese',
      languageCodeISO6391: 'ja',
    }),
  ];

  const celContext: StreamSelectionCelContext = buildCelContext(
    audioStreams,
    subtitleStreams,
    { name: 'Test', number: 1 },
    { title: 'Test Movie', type: 'movie' },
  );

  const lineupItem = makeLineupItem();

  describe('rule matching', () => {
    it('returns first matching rule result', async () => {
      const profile = makeProfile([
        makeRule({
          label: 'First',
          condition: 'first_cond',
          audioAction: { type: 'default' },
          subtitleAction: { type: 'disable' },
        }),
        makeRule({
          label: 'Second',
          condition: 'second_cond',
          audioAction: { type: 'by_language', languages: ['jpn'] },
          subtitleAction: { type: 'disable' },
        }),
      ]);

      const celService = makeCelService(
        (expr: string) => expr === 'first_cond',
      );

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subtitleStreams,
        celService,
        celContext,
        lineupItem,
      );

      // First rule matched -> default audio -> should return selected/default/first
      expect(result.audioStream).toBe(audioStreams[0]);
      expect(result.subtitleStream).toBeNull();
    });

    it('skips non-matching rules and uses next match', async () => {
      const profile = makeProfile([
        makeRule({
          label: 'Skip this',
          condition: 'no_match',
          audioAction: { type: 'default' },
          subtitleAction: { type: 'disable' },
        }),
        makeRule({
          label: 'Use this',
          condition: 'matches',
          audioAction: { type: 'by_language', languages: ['jpn'] },
          subtitleAction: { type: 'disable' },
        }),
      ]);

      const celService = makeCelService((expr: string) => expr === 'matches');

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subtitleStreams,
        celService,
        celContext,
        lineupItem,
      );

      // Second rule matched -> by_language jpn -> audioStreams[1]
      expect(result.audioStream.languageCodeISO6392).toBe('jpn');
    });

    it('falls back to defaults when no rules match', async () => {
      const profile = makeProfile([makeRule({ condition: 'nope' })]);

      const celService = makeCelService(false);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subtitleStreams,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream).toBe(audioStreams[0]);
      expect(result.subtitleStream).toBeNull();
    });
  });

  describe('audio action: default', () => {
    it('picks selected stream first', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0 }),
        makeAudioStream({ index: 1, selected: true }),
      ];
      const profile = makeProfile([
        makeRule({ audioAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.index).toBe(1);
    });

    it('picks default stream if none selected', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0 }),
        makeAudioStream({ index: 1, default: true }),
      ];
      const profile = makeProfile([
        makeRule({ audioAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.index).toBe(1);
    });

    it('picks first stream as last resort', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0 }),
        makeAudioStream({ index: 1 }),
      ];
      const profile = makeProfile([
        makeRule({ audioAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.index).toBe(0);
    });
  });

  describe('audio action: by_language', () => {
    it('finds audio stream by ISO 639-2 code', async () => {
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['jpn'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.languageCodeISO6392).toBe('jpn');
    });

    it('finds audio stream by ISO 639-1 code', async () => {
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['ja'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.languageCodeISO6391).toBe('ja');
    });

    it('finds audio stream by full language name', async () => {
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['japanese'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.language).toBe('Japanese');
    });

    it('respects language priority order', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, languageCodeISO6392: 'fra' }),
        makeAudioStream({ index: 1, languageCodeISO6392: 'eng' }),
        makeAudioStream({ index: 2, languageCodeISO6392: 'jpn' }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['jpn', 'eng'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      // jpn is first preference and it exists
      expect(result.audioStream.languageCodeISO6392).toBe('jpn');
    });

    it('falls through to next language when first is missing', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({
          index: 0,
          languageCodeISO6392: 'fra',
          languageCodeISO6391: 'fr',
          language: 'French',
        }),
        makeAudioStream({ index: 1, languageCodeISO6392: 'eng' }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['jpn', 'eng'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.languageCodeISO6392).toBe('eng');
    });

    it('falls back to selected/default/first when no language matches', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, languageCodeISO6392: 'fra' }),
        makeAudioStream({
          index: 1,
          languageCodeISO6392: 'deu',
          default: true,
        }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['jpn'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      // Fallback: no selected, one default
      expect(result.audioStream.index).toBe(1);
    });

    it('prefers most channels when configured', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, languageCodeISO6392: 'eng', channels: 2 }),
        makeAudioStream({ index: 1, languageCodeISO6392: 'eng', channels: 6 }),
        makeAudioStream({ index: 2, languageCodeISO6392: 'eng', channels: 8 }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: {
            type: 'by_language',
            languages: ['eng'],
            preferChannels: 'most',
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.channels).toBe(8);
    });

    it('prefers least channels when configured', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, languageCodeISO6392: 'eng', channels: 6 }),
        makeAudioStream({ index: 1, languageCodeISO6392: 'eng', channels: 2 }),
        makeAudioStream({ index: 2, languageCodeISO6392: 'eng', channels: 8 }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: {
            type: 'by_language',
            languages: ['eng'],
            preferChannels: 'least',
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.channels).toBe(2);
    });

    it('is case-insensitive for language matching', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, languageCodeISO6392: 'ENG' }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_language', languages: ['eng'] },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.index).toBe(0);
    });
  });

  describe('audio action: by_title', () => {
    it('finds stream by title substring match', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, title: 'Stereo' }),
        makeAudioStream({ index: 1, title: 'Surround 5.1' }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_title', titleContains: 'surround' },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.title).toBe('Surround 5.1');
    });

    it('is case-insensitive', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, title: 'DTS-HD Master Audio' }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_title', titleContains: 'dts-hd' },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.audioStream.index).toBe(0);
    });

    it('falls back when no title matches', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, title: 'Stereo' }),
        makeAudioStream({ index: 1, title: 'Commentary', selected: true }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_title', titleContains: 'atmos' },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      // Fallback: selected stream
      expect(result.audioStream.index).toBe(1);
    });

    it('handles streams with no title', async () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({ index: 0, title: undefined }),
        makeAudioStream({ index: 1, title: undefined, default: true }),
      ];
      const profile = makeProfile([
        makeRule({
          audioAction: { type: 'by_title', titleContains: 'surround' },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        streams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      // Fallback: default stream
      expect(result.audioStream.index).toBe(1);
    });
  });

  describe('subtitle action: disable', () => {
    it('returns null subtitle', async () => {
      const profile = makeProfile([
        makeRule({ subtitleAction: { type: 'disable' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subtitleStreams,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });
  });

  describe('subtitle action: default', () => {
    it('returns default subtitle stream', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 2, default: false }),
        makeSubtitleStream({
          index: 3,
          default: true,
          languageCodeISO6392: 'eng',
        }),
      ];
      const profile = makeProfile([
        makeRule({ subtitleAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.index).toBe(3);
    });

    it('falls back to the first candidate when nothing is flagged default', async () => {
      // Parity with the legacy SubtitleStreamPicker, which used
      // `defaultStream ?? orderedStreams[0]`. External subs often carry no
      // default flag, and dropping them entirely loses subtitles.
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 2, default: false, type: 'external' }),
        makeSubtitleStream({ index: 3, default: false, type: 'external' }),
      ];
      const profile = makeProfile([
        makeRule({ subtitleAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream?.index).toBe(2);
    });

    it('returns null when subtitles are undefined', async () => {
      const profile = makeProfile([
        makeRule({ subtitleAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });

    it('returns null when subtitles are empty', async () => {
      const profile = makeProfile([
        makeRule({ subtitleAction: { type: 'default' } }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        [],
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });
  });

  describe('subtitle action: by_language', () => {
    it('finds subtitle by language code', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 2, languageCodeISO6392: 'eng' }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'jpn',
          language: 'Japanese',
          languageCodeISO6391: 'ja',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['jpn'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.languageCodeISO6392).toBe('jpn');
    });

    it('respects language priority order', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 2, languageCodeISO6392: 'fra' }),
        makeSubtitleStream({ index: 3, languageCodeISO6392: 'eng' }),
        makeSubtitleStream({ index: 4, languageCodeISO6392: 'jpn' }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['jpn', 'eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream!.languageCodeISO6392).toBe('jpn');
    });

    it('filters by forced when filterType is forced', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          forced: false,
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'eng',
          forced: true,
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'forced',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream!.index).toBe(3);
      expect(result.subtitleStream!.forced).toBe(true);
    });

    it('filters by default flag when filterType is default', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          default: false,
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'eng',
          default: true,
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'default',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream!.index).toBe(3);
      expect(result.subtitleStream!.default).toBe(true);
    });

    it('rejects external subtitles when allowExternal is false', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          type: 'external',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: false,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });

    it('allows external subtitles when allowExternal is true', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          type: 'external',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
    });

    it('rejects image-based subtitles when allowImageBased is false', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: false,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });

    it('allows image-based subtitles when allowImageBased is true', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      // Image-based subs are not 'embedded text-based', so they're returned directly
      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.codec).toBe('hdmv_pgs_subtitle');
    });

    it('returns null when no subtitles match language', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'fra',
          languageCodeISO6391: 'fr',
          language: 'French',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });

    it('returns null when subtitles are undefined', async () => {
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        undefined,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });

    it('is case-insensitive for subtitle language matching', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 2, languageCodeISO6392: 'ENG' }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
    });

    it('recognizes all image-based subtitle codecs', async () => {
      const imageCodecs = [
        'hdmv_pgs_subtitle',
        'pgssub',
        'dvd_subtitle',
        'dvdsub',
        'dvbsub',
      ];

      for (const codec of imageCodecs) {
        const subs: SubtitleStreamDetails[] = [
          makeSubtitleStream({
            index: 2,
            languageCodeISO6392: 'eng',
            codec,
            type: 'embedded',
          }),
        ];
        const profile = makeProfile([
          makeRule({
            subtitleAction: {
              type: 'by_language',
              languages: ['eng'],
              filterType: 'any',
              allowImageBased: false,
              allowExternal: true,
            },
          }),
        ]);
        const celService = makeCelService(true);

        const result = await evaluateStreamSelectionProfile(
          profile,
          audioStreams,
          subs,
          celService,
          celContext,
          lineupItem,
        );

        expect(result.subtitleStream).toBeNull();
      }
    });

    it('is case-insensitive for image codec detection', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'HDMV_PGS_SUBTITLE',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: false,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });

    it('returns null when filterType is none', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          type: 'external',
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'jpn',
          type: 'external',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng', 'jpn'],
            filterType: 'none',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });
  });

  describe('preferTextBased', () => {
    it('without preferTextBased, by_language picks first matching stream regardless of codec type', async () => {
      // Image-based sub appears first in stream order, text-based second.
      // Without preferTextBased, the image-based sub should be picked
      // because it comes first and allowImageBased is true.
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
            // preferTextBased not set (defaults to false)
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      // Image-based sub is first and should be selected
      expect(result.subtitleStream!.index).toBe(2);
      expect(result.subtitleStream!.codec).toBe('hdmv_pgs_subtitle');
    });

    it('without preferTextBased, embedded text sub goes through extraction', async () => {
      // The mock adds path: '/fake/path.vtt' via getSubtitleDetailsWithExtractedPath.
      // Without preferTextBased, embedded text subs must go through that extraction
      // step, so the returned stream should have the mock's path property.
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
            // preferTextBased not set (defaults to false)
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      // Extraction mock adds path — confirms the extraction path was taken
      expect((result.subtitleStream as Record<string, unknown>)['path']).toBe(
        '/fake/path.vtt',
      );
    });

    it('without preferTextBased, default embedded text sub goes through extraction', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          default: true,
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: { type: 'default' },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      expect((result.subtitleStream as Record<string, unknown>)['path']).toBe(
        '/fake/path.vtt',
      );
    });

    it('by_language with action preferTextBased selects text-based sub over image-based', async () => {
      // Image-based sub appears first in stream order, text-based second.
      // With preferTextBased, text-based should be selected.
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
            preferTextBased: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.index).toBe(3);
      expect(result.subtitleStream!.codec).toBe('srt');
    });

    it('by_language with runtime hint preferTextBased selects text-based sub over image-based', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
        { preferTextBased: true },
      );

      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.index).toBe(3);
      expect(result.subtitleStream!.codec).toBe('srt');
    });

    it('by_language with action preferTextBased still extracts embedded text subs', async () => {
      // A profile may only express a sorting preference. Skipping extraction is
      // a caller capability, so without the hint the stream must come back with
      // a real path — the transcode path burns from that file and would
      // otherwise be handed the video as a subtitle source.
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
            preferTextBased: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.index).toBe(2);
      expect((result.subtitleStream as Record<string, unknown>)['path']).toBe(
        '/fake/path.vtt',
      );
    });

    it('by_language with the runtime hint returns embedded text subs unextracted', async () => {
      // The hint means the caller can mux the embedded stream straight from the
      // container, so extraction is skipped and no path is set.
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
            preferTextBased: false,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
        { preferTextBased: true },
      );

      expect(result.subtitleStream!.index).toBe(2);
      expect(
        (result.subtitleStream as Record<string, unknown>)['path'],
      ).toBeUndefined();
    });

    it('default with action preferTextBased still extracts embedded text subs', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          default: true,
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'default',
            preferTextBased: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream!.index).toBe(2);
      expect((result.subtitleStream as Record<string, unknown>)['path']).toBe(
        '/fake/path.vtt',
      );
    });

    it('default with the runtime hint returns embedded text subs unextracted', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          default: true,
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'default',
            preferTextBased: false,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
        { preferTextBased: true },
      );

      expect(result.subtitleStream!.index).toBe(2);
      expect(
        (result.subtitleStream as Record<string, unknown>)['path'],
      ).toBeUndefined();
    });

    it('runtime hint overrides action preferTextBased=false', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          languageCodeISO6392: 'eng',
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
        makeSubtitleStream({
          index: 3,
          languageCodeISO6392: 'eng',
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      // Action has preferTextBased: false (default)
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'by_language',
            languages: ['eng'],
            filterType: 'any',
            allowImageBased: true,
            allowExternal: true,
            preferTextBased: false,
          },
        }),
      ]);
      const celService = makeCelService(true);

      // Runtime hint overrides to true
      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
        { preferTextBased: true },
      );

      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.index).toBe(3);
      expect(result.subtitleStream!.codec).toBe('srt');
    });

    it('default with preferTextBased sorts text-based before image-based for default selection', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 2,
          default: true,
          codec: 'hdmv_pgs_subtitle',
          type: 'embedded',
        }),
        makeSubtitleStream({
          index: 3,
          default: true,
          codec: 'srt',
          type: 'embedded',
        }),
      ];
      const profile = makeProfile([
        makeRule({
          subtitleAction: {
            type: 'default',
            preferTextBased: true,
          },
        }),
      ]);
      const celService = makeCelService(true);

      const result = await evaluateStreamSelectionProfile(
        profile,
        audioStreams,
        subs,
        celService,
        celContext,
        lineupItem,
      );

      // Text-based default should be found first due to sorting
      expect(result.subtitleStream).not.toBeNull();
      expect(result.subtitleStream!.index).toBe(3);
      expect(result.subtitleStream!.codec).toBe('srt');
    });
  });
});

// ── ISO 639-2 bibliographic vs terminological codes ─────────────────────────
//
// ISO 639-2 gives 20 languages two 3-letter codes: a bibliographic (/B) code
// derived from the English name (German -> "ger") and a terminological (/T)
// code derived from the native name (Deutsch -> "deu"). Media servers and
// containers use them interchangeably, so a language preference stored in one
// code set must still match a stream tagged in the other.
// Regression test for https://github.com/chrisbenincasa/tunarr/issues/1960

describe('ISO 639-2 B/T language code matching', () => {
  const lineupItem = makeLineupItem();

  function germanAudio(index: number, code: string): AudioStreamDetails {
    return makeAudioStream({
      index,
      codec: 'aac',
      channels: 2,
      language: undefined,
      languageCodeISO6391: undefined,
      languageCodeISO6392: code,
      title: 'German',
    });
  }

  function englishAudio(index: number): AudioStreamDetails {
    return makeAudioStream({
      index,
      codec: 'eac3',
      channels: 6,
      language: undefined,
      languageCodeISO6391: undefined,
      languageCodeISO6392: 'eng',
      title: 'English',
    });
  }

  describe('audio', () => {
    it('matches a bibliographic preference against a terminological stream', () => {
      // The exact shape reported in issue #1960: the preference list is built
      // from /B codes while Jellyfin/ffprobe report the /T code.
      const streams: NonEmptyArray<AudioStreamDetails> = [
        germanAudio(1, 'deu'),
        englishAudio(2),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['ger', 'eng'] },
        streams,
      );

      expect(picked.index).toBe(1);
    });

    it('matches a terminological preference against a bibliographic stream', () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        germanAudio(1, 'ger'),
        englishAudio(2),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['deu', 'eng'] },
        streams,
      );

      expect(picked.index).toBe(1);
    });

    it('matches a two-letter preference against either code set', () => {
      // English is listed first so that a failed match falls back to it,
      // making this assertion sensitive to the German match actually working.
      for (const code of ['ger', 'deu']) {
        const streams: NonEmptyArray<AudioStreamDetails> = [
          englishAudio(1),
          germanAudio(2, code),
        ];

        const picked = resolveAudioAction(
          { type: 'by_language', languages: ['de'] },
          streams,
        );

        expect(picked.index).toBe(2);
      }
    });

    it('honors preference order across code sets', () => {
      // French preference is listed second, so English must win even though
      // the French stream is tagged with the other code set.
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({
          index: 1,
          languageCodeISO6392: 'fra',
          languageCodeISO6391: undefined,
          language: undefined,
        }),
        englishAudio(2),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['eng', 'fre'] },
        streams,
      );

      expect(picked.index).toBe(2);
    });

    it('still matches languages with a single ISO 639-2 code', () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        englishAudio(1),
        makeAudioStream({
          index: 2,
          languageCodeISO6392: 'jpn',
          languageCodeISO6391: undefined,
          language: undefined,
        }),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['jpn'] },
        streams,
      );

      expect(picked.index).toBe(2);
    });

    it('falls back to the default stream when no code set matches', () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        englishAudio(1),
        makeAudioStream({
          index: 2,
          languageCodeISO6392: 'jpn',
          languageCodeISO6391: undefined,
          language: undefined,
          default: true,
        }),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['ger'] },
        streams,
      );

      expect(picked.index).toBe(2);
    });

    it('resolves a conflicting stream by tag precedence, not by any-field match', () => {
      // ISO 639-2 is the most specific tag, so a stream carrying a stale or
      // contradictory ISO 639-1 / free-form value is still German only.
      const streams: NonEmptyArray<AudioStreamDetails> = [
        englishAudio(1),
        makeAudioStream({
          index: 2,
          languageCodeISO6392: 'ger',
          languageCodeISO6391: 'en',
          language: 'English',
        }),
      ];

      expect(
        resolveAudioAction({ type: 'by_language', languages: ['deu'] }, streams)
          .index,
      ).toBe(2);

      // ...and the English preference must not be satisfied by that stream.
      expect(
        resolveAudioAction({ type: 'by_language', languages: ['eng'] }, streams)
          .index,
      ).toBe(1);
    });

    it('falls back to ISO 639-1 when no ISO 639-2 tag is present', () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        englishAudio(1),
        makeAudioStream({
          index: 2,
          languageCodeISO6392: undefined,
          languageCodeISO6391: 'de',
          language: 'German',
        }),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['ger'] },
        streams,
      );

      expect(picked.index).toBe(2);
    });

    it('matches unresolvable codes by exact string as before', () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        englishAudio(1),
        makeAudioStream({
          index: 2,
          languageCodeISO6392: 'qaa',
          languageCodeISO6391: undefined,
          language: undefined,
        }),
      ];

      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['qaa'] },
        streams,
      );

      expect(picked.index).toBe(2);
    });

    it('applies preferChannels within a cross-code-set match', () => {
      const streams: NonEmptyArray<AudioStreamDetails> = [
        makeAudioStream({
          index: 1,
          languageCodeISO6392: 'deu',
          languageCodeISO6391: undefined,
          language: undefined,
          channels: 2,
        }),
        makeAudioStream({
          index: 2,
          languageCodeISO6392: 'ger',
          languageCodeISO6391: undefined,
          language: undefined,
          channels: 6,
        }),
      ];

      // Both streams are German. Only the 6-channel one is tagged with the
      // other code set, so 'most' can only reach it if both codes match.
      const picked = resolveAudioAction(
        { type: 'by_language', languages: ['deu'], preferChannels: 'most' },
        streams,
      );

      expect(picked.index).toBe(2);
    });
  });

  describe('subtitles', () => {
    const audioStreams: NonEmptyArray<AudioStreamDetails> = [englishAudio(0)];
    const celContext: StreamSelectionCelContext = buildCelContext(
      audioStreams,
      [],
      { name: 'Test', number: 1 },
      { title: 'Test Movie', type: 'movie' },
    );

    it('matches a bibliographic preference against a terminological stream', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 3,
          type: 'external',
          languageCodeISO6392: 'deu',
          languageCodeISO6391: undefined,
          language: undefined,
        }),
        makeSubtitleStream({ index: 4, type: 'external' }),
      ];

      const result = await evaluateStreamSelectionProfile(
        makeProfile([
          makeRule({
            subtitleAction: {
              type: 'by_language',
              languages: ['ger'],
              filterType: 'any',
              allowImageBased: true,
              allowExternal: true,
            },
          }),
        ]),
        audioStreams,
        subs,
        makeCelService(true),
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream?.index).toBe(3);
    });

    it('matches a terminological preference against a bibliographic stream', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({
          index: 3,
          type: 'external',
          languageCodeISO6392: 'ger',
          languageCodeISO6391: undefined,
          language: undefined,
        }),
        makeSubtitleStream({ index: 4, type: 'external' }),
      ];

      const result = await evaluateStreamSelectionProfile(
        makeProfile([
          makeRule({
            subtitleAction: {
              type: 'by_language',
              languages: ['deu'],
              filterType: 'any',
              allowImageBased: true,
              allowExternal: true,
            },
          }),
        ]),
        audioStreams,
        subs,
        makeCelService(true),
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream?.index).toBe(3);
    });

    it('returns null when neither code set matches', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 4, type: 'external' }),
      ];

      const result = await evaluateStreamSelectionProfile(
        makeProfile([
          makeRule({
            subtitleAction: {
              type: 'by_language',
              languages: ['ger'],
              filterType: 'any',
              allowImageBased: true,
              allowExternal: true,
            },
          }),
        ]),
        audioStreams,
        subs,
        makeCelService(true),
        celContext,
        lineupItem,
      );

      expect(result.subtitleStream).toBeNull();
    });
  });
});

// ── evaluateSubtitleSelection ───────────────────────────────────────────────

describe('evaluateSubtitleSelection', () => {
  const audioStreams: NonEmptyArray<AudioStreamDetails> = [
    makeAudioStream({ index: 0, languageCodeISO6392: 'eng' }),
  ];

  const subtitleStreams: SubtitleStreamDetails[] = [
    makeSubtitleStream({
      index: 2,
      languageCodeISO6392: 'eng',
      type: 'external',
    }),
    makeSubtitleStream({
      index: 3,
      languageCodeISO6392: 'jpn',
      language: 'Japanese',
      languageCodeISO6391: 'ja',
      type: 'external',
    }),
  ];

  const celContext: StreamSelectionCelContext = buildCelContext(
    audioStreams,
    subtitleStreams,
    { name: 'Test', number: 1 },
    { title: 'Test Movie', type: 'movie' },
  );

  const lineupItem = makeLineupItem();

  it('resolves the subtitle action of the first matching rule', async () => {
    const profile = makeProfile([
      makeRule({
        condition: 'false',
        subtitleAction: {
          type: 'by_language',
          languages: ['eng'],
          filterType: 'any',
          allowImageBased: true,
          allowExternal: true,
          preferTextBased: false,
        },
      }),
      makeRule({
        condition: 'true',
        subtitleAction: {
          type: 'by_language',
          languages: ['jpn'],
          filterType: 'any',
          allowImageBased: true,
          allowExternal: true,
          preferTextBased: false,
        },
      }),
    ]);
    const celService = makeCelService((expr) => expr === 'true');

    const result = await evaluateSubtitleSelection(
      profile,
      subtitleStreams,
      celService,
      celContext,
      lineupItem,
    );

    expect(result?.index).toBe(3);
  });

  it('returns null when no rule matches', async () => {
    const profile = makeProfile([
      makeRule({
        condition: 'false',
        subtitleAction: {
          type: 'by_language',
          languages: ['eng'],
          filterType: 'any',
          allowImageBased: true,
          allowExternal: true,
          preferTextBased: false,
        },
      }),
    ]);
    const celService = makeCelService(false);

    const result = await evaluateSubtitleSelection(
      profile,
      subtitleStreams,
      celService,
      celContext,
      lineupItem,
    );

    expect(result).toBeNull();
  });

  it('returns null for a disable action', async () => {
    const profile = makeProfile([
      makeRule({ subtitleAction: { type: 'disable' } }),
    ]);

    const result = await evaluateSubtitleSelection(
      profile,
      subtitleStreams,
      makeCelService(true),
      celContext,
      lineupItem,
    );

    expect(result).toBeNull();
  });

  it('falls back to the first candidate when nothing is flagged default', async () => {
    const profile = makeProfile([
      makeRule({
        subtitleAction: { type: 'default', preferTextBased: false },
      }),
    ]);

    const result = await evaluateSubtitleSelection(
      profile,
      subtitleStreams,
      makeCelService(true),
      celContext,
      lineupItem,
    );

    expect(result?.index).toBe(2);
  });

  it('skips extraction for embedded text subs when the caller hints it can', async () => {
    const embedded: SubtitleStreamDetails[] = [
      makeSubtitleStream({
        index: 2,
        languageCodeISO6392: 'eng',
        codec: 'srt',
        type: 'embedded',
      }),
    ];
    const profile = makeProfile([
      makeRule({
        subtitleAction: { type: 'default', preferTextBased: false },
      }),
    ]);

    const result = await evaluateSubtitleSelection(
      profile,
      embedded,
      makeCelService(true),
      celContext,
      lineupItem,
      { preferTextBased: true },
    );

    expect((result as Record<string, unknown>)['path']).toBeUndefined();
  });

  it('extracts embedded text subs when the caller gives no hint', async () => {
    const embedded: SubtitleStreamDetails[] = [
      makeSubtitleStream({
        index: 2,
        languageCodeISO6392: 'eng',
        codec: 'srt',
        type: 'embedded',
      }),
    ];
    const profile = makeProfile([
      makeRule({
        subtitleAction: { type: 'default', preferTextBased: true },
      }),
    ]);

    const result = await evaluateSubtitleSelection(
      profile,
      embedded,
      makeCelService(true),
      celContext,
      lineupItem,
    );

    expect((result as Record<string, unknown>)['path']).toBe('/fake/path.vtt');
  });

  it('returns null when there are no subtitle streams', async () => {
    const profile = makeProfile([
      makeRule({
        subtitleAction: { type: 'default', preferTextBased: false },
      }),
    ]);

    const result = await evaluateSubtitleSelection(
      profile,
      undefined,
      makeCelService(true),
      celContext,
      lineupItem,
    );

    expect(result).toBeNull();
  });
});
