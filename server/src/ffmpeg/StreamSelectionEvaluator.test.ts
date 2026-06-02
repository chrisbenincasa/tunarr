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
        makeAudioStream({ index: 0, languageCodeISO6392: 'fra' }),
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

    it('returns null when no default subtitle exists', async () => {
      const subs: SubtitleStreamDetails[] = [
        makeSubtitleStream({ index: 2, default: false }),
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

      expect(result.subtitleStream).toBeNull();
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
        makeSubtitleStream({ index: 2, languageCodeISO6392: 'fra' }),
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
});
