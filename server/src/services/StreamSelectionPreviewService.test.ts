import { tag } from '@tunarr/types';
import type { StreamSelectionRule } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { describe, expect, it, vi } from 'vitest';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { MediaSourceId } from '../db/schema/base.ts';
import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { ProgramStreamDetailsFetcher } from '../stream/ProgramStreamDetailsFetcher.ts';
import type {
  AudioStreamDetails,
  ProgramStreamResult,
  SubtitleStreamDetails,
} from '../stream/types.ts';
import { HttpStreamSource } from '../stream/types.ts';
import {
  createChannelOrm,
  createFakeProgramOrm,
} from '../testing/fakes/entityCreators.ts';
import { Result } from '../types/result.ts';
import { isNonEmptyArray } from '../util/index.ts';
import { CelEvaluationService } from './CelEvaluationService.ts';
import { StreamSelectionPreviewService } from './StreamSelectionPreviewService.ts';
import type {
  StreamSelectionProgramContextLoader,
  StreamSelectionProgramRef,
} from './StreamSelectionProgramContextLoader.ts';

dayjs.extend(duration);

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = '22222222-2222-4222-8222-222222222222';
const MEDIA_SOURCE_ID = '33333333-3333-4333-8333-333333333333';

const engAudio: AudioStreamDetails = {
  index: 1,
  codec: 'aac',
  channels: 2,
  default: true,
  languageCodeISO6392: 'eng',
};
const jpnAudio: AudioStreamDetails = {
  index: 2,
  codec: 'flac',
  channels: 6,
  default: false,
  languageCodeISO6392: 'jpn',
};
const engSubtitle: SubtitleStreamDetails = {
  type: 'embedded',
  index: 3,
  codec: 'subrip',
  default: false,
  forced: false,
  sdh: false,
  languageCodeISO6392: 'eng',
};

function rule(
  condition: string,
  overrides: Partial<StreamSelectionRule> = {},
): StreamSelectionRule {
  return {
    condition,
    audioAction: { type: 'default' },
    subtitleAction: { type: 'disable' },
    ...overrides,
  };
}

const japaneseWithEnglishSubs = rule('true', {
  label: 'Japanese',
  audioAction: { type: 'by_language', languages: ['jpn'] },
  subtitleAction: {
    type: 'by_language',
    languages: ['eng'],
    filterType: 'any',
    allowImageBased: true,
    allowExternal: true,
    preferTextBased: false,
  },
});

type HarnessOptions = {
  programFound?: boolean;
  channelFound?: boolean;
  audio?: AudioStreamDetails[];
  subtitles?: SubtitleStreamDetails[];
  streamError?: Error;
  genres?: string[];
};

function createService(opts: HarnessOptions = {}) {
  const program = createFakeProgramOrm({
    uuid: PROGRAM_ID,
    title: 'Spirited Away',
    type: 'movie',
    mediaSourceId: tag<MediaSourceId>(MEDIA_SOURCE_ID),
  });

  const programDB = {
    getProgramById: vi
      .fn()
      .mockResolvedValue(opts.programFound === false ? undefined : program),
  } as unknown as IProgramDB;

  const channelDB = {
    getChannel: vi
      .fn()
      .mockResolvedValue(
        opts.channelFound === false
          ? undefined
          : createChannelOrm({ uuid: CHANNEL_ID, name: 'Anime', number: 7 }),
      ),
  } as unknown as IChannelDB;

  const mediaSourceDB = {
    getById: vi.fn().mockResolvedValue({ uuid: MEDIA_SOURCE_ID }),
  } as unknown as MediaSourceDB;

  const audio = opts.audio ?? [engAudio, jpnAudio];
  const subtitles = opts.subtitles ?? [engSubtitle];
  const streamResult: ProgramStreamResult = {
    streamSource: new HttpStreamSource('http://example.com/video.mkv'),
    streamDetails: {
      duration: dayjs.duration(1, 'hour'),
      audioDetails: isNonEmptyArray(audio) ? audio : undefined,
      subtitleDetails: isNonEmptyArray(subtitles) ? subtitles : undefined,
    },
  };
  const streamDetailsFetcher = {
    getStream: vi
      .fn()
      .mockResolvedValue(
        opts.streamError
          ? Result.forError(opts.streamError)
          : Result.success(streamResult),
      ),
  } as unknown as ProgramStreamDetailsFetcher;

  const programContextLoader = {
    load: (ref: StreamSelectionProgramRef) =>
      Promise.resolve({
        title: ref.title,
        type: ref.type,
        showTitle: '',
        genres: opts.genres ?? [],
        libraryId: '',
      }),
  } as unknown as StreamSelectionProgramContextLoader;

  return new StreamSelectionPreviewService(
    programDB,
    channelDB,
    mediaSourceDB,
    streamDetailsFetcher,
    new CelEvaluationService(),
    programContextLoader,
  );
}

async function previewSuccess(
  service: StreamSelectionPreviewService,
  rules: StreamSelectionRule[],
  channelId?: string,
) {
  const outcome = await service.preview({
    rules,
    programId: PROGRAM_ID,
    channelId,
  });
  if (outcome.type !== 'success') {
    throw new Error(
      `Expected success, got ${outcome.type}: ${outcome.message}`,
    );
  }
  return outcome.result;
}

describe('StreamSelectionPreviewService', () => {
  it('applies the first matching rule and reports every rule', async () => {
    const result = await previewSuccess(createService(), [
      rule('false', { label: 'Never' }),
      japaneseWithEnglishSubs,
      rule('true', { label: 'Also matches' }),
    ]);

    expect(result.rules.map((r) => r.matched)).toEqual([false, true, true]);
    expect(result.matchedRuleIndex).toBe(1);
    expect(result.selectedAudioStream?.index).toBe(2);
    expect(result.selectedSubtitleStream?.index).toBe(3);
    expect(result.program).toEqual({
      uuid: PROGRAM_ID,
      title: 'Spirited Away',
      type: 'movie',
    });
    expect(result.audioStreams.map((s) => s.language)).toEqual(['eng', 'jpn']);
  });

  it('reports no match without falling back to defaults', async () => {
    const result = await previewSuccess(createService(), [rule('false')]);

    expect(result.matchedRuleIndex).toBeNull();
    expect(result.selectedAudioStream).toBeUndefined();
    expect(result.selectedSubtitleStream).toBeNull();
  });

  it('flags a condition that does not parse', async () => {
    const result = await previewSuccess(createService(), [
      rule('audio.languages.exists('),
      rule('true'),
    ]);

    expect(result.rules[0]?.matched).toBe(false);
    expect(result.rules[0]?.error).toBeDefined();
    expect(result.rules[1]?.error).toBeUndefined();
    expect(result.matchedRuleIndex).toBe(1);
  });

  it('exposes the channel to rule conditions when one is given', async () => {
    const rules = [rule('channel.name == "Anime"')];

    const withChannel = await previewSuccess(
      createService(),
      rules,
      CHANNEL_ID,
    );
    expect(withChannel.matchedRuleIndex).toBe(0);
    expect(withChannel.channel).toEqual({
      uuid: CHANNEL_ID,
      name: 'Anime',
      number: 7,
    });

    const withoutChannel = await previewSuccess(createService(), rules);
    expect(withoutChannel.matchedRuleIndex).toBeNull();
    expect(withoutChannel.channel).toBeUndefined();
  });

  it('exposes loaded program fields to rule conditions', async () => {
    const result = await previewSuccess(
      createService({ genres: ['Anime', 'Fantasy'] }),
      [rule('"Anime" in program.genres')],
    );

    expect(result.matchedRuleIndex).toBe(0);
  });

  it('selects subtitles for content with no audio streams', async () => {
    const result = await previewSuccess(createService({ audio: [] }), [
      japaneseWithEnglishSubs,
    ]);

    expect(result.selectedAudioStream).toBeUndefined();
    expect(result.selectedSubtitleStream?.index).toBe(3);
  });

  it('returns not_found for an unknown program', async () => {
    const outcome = await createService({ programFound: false }).preview({
      rules: [rule('true')],
      programId: PROGRAM_ID,
    });

    expect(outcome.type).toBe('not_found');
  });

  it('returns not_found for an unknown channel', async () => {
    const outcome = await createService({ channelFound: false }).preview({
      rules: [rule('true')],
      programId: PROGRAM_ID,
      channelId: CHANNEL_ID,
    });

    expect(outcome.type).toBe('not_found');
  });

  it('returns streams_unavailable when the media source fails', async () => {
    const outcome = await createService({
      streamError: new Error('server unreachable'),
    }).preview({ rules: [rule('true')], programId: PROGRAM_ID });

    expect(outcome.type).toBe('streams_unavailable');
    expect(outcome.type !== 'success' && outcome.message).toContain(
      'server unreachable',
    );
  });
});
