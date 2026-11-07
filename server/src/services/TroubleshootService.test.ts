import type { StreamSelectionProfile } from '@tunarr/types/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { StreamDetails, SubtitleStreamDetails } from '../stream/types.ts';
import { CelEvaluationService } from './CelEvaluationService.ts';
import type { StreamSelectionContext } from './StreamSelectionProfileResolver.ts';
import { TroubleshootService } from './TroubleshootService.ts';

// No subtitle has been extracted, so embedded text subtitles have no file.
vi.mock('../ffmpeg/SubtitleStreamPicker.ts', () => ({
  SubtitleStreamPicker: {
    getSubtitleDetailsWithExtractedPath: vi.fn(() => Promise.resolve()),
  },
}));

const CHANNEL_ID = 'channel-1';
const PROGRAM_ID = 'program-1';
const CUSTOM_SHOW_ID = 'custom-show-1';

const selectGermanSubtitles: StreamSelectionProfile = {
  uuid: 'profile-1',
  name: 'German subtitles',
  locked: false,
  rules: [
    {
      label: 'German',
      condition: 'true',
      audioAction: { type: 'default' },
      subtitleAction: {
        type: 'by_language',
        languages: ['ger'],
        filterType: 'any',
        allowImageBased: true,
        allowExternal: true,
        preferTextBased: false,
      },
    },
  ],
};

function subtitle(
  overrides: Partial<SubtitleStreamDetails>,
): SubtitleStreamDetails {
  return {
    type: 'embedded',
    codec: 'subrip',
    index: 2,
    default: false,
    forced: false,
    sdh: false,
    languageCodeISO6392: 'deu',
    ...overrides,
  };
}

async function trace(subtitleDetails: SubtitleStreamDetails[]) {
  const resolveChain = vi.fn((_ctx: StreamSelectionContext) =>
    Promise.resolve([
      {
        level: 'custom_show' as const,
        sourceId: CUSTOM_SHOW_ID,
        profile: selectGermanSubtitles,
      },
    ]),
  );

  const service = new TroubleshootService(
    ...([
      {},
      {},
      { resolveChain },
      new CelEvaluationService(),
      ...Array.from({ length: 8 }, () => ({})),
    ] as ConstructorParameters<typeof TroubleshootService>),
  );

  const streamDetails: StreamDetails = {
    audioDetails: [{ index: 1, codec: 'aac', channels: 2 }],
    subtitleDetails,
  } as StreamDetails;

  const result: { streamSelection?: unknown } = {};
  const errors: string[] = [];

  await (
    service as unknown as {
      traceStreamSelection(args: unknown): Promise<void>;
    }
  ).traceStreamSelection({
    channel: { uuid: CHANNEL_ID, name: 'Channel', number: 1 },
    lineup: {
      items: [
        {
          type: 'content',
          id: PROGRAM_ID,
          durationMs: 1000,
          customShowId: CUSTOM_SHOW_ID,
        },
      ],
    },
    program: {
      uuid: PROGRAM_ID,
      title: 'Movie',
      type: 'movie',
      duration: 1000,
      mediaSourceId: 'media-source-1',
      externalKey: 'key',
      sourceType: 'jellyfin',
    },
    streamDetails: { streamSource: {}, streamDetails },
    result,
    errors,
  });

  expect(errors).toEqual([]);
  return {
    resolveChain,
    selection: result.streamSelection as {
      selectedSubtitleStream?: { index: number } | null;
      subtitleReason?: string;
    },
  };
}

describe('TroubleshootService stream selection trace', () => {
  it('resolves the chain with the custom show from the channel lineup', async () => {
    const { resolveChain } = await trace([]);

    expect(resolveChain).toHaveBeenCalledExactlyOnceWith({
      channelId: CHANNEL_ID,
      programId: PROGRAM_ID,
      fillerListId: undefined,
      customShowId: CUSTOM_SHOW_ID,
    });
  });

  // The transcode session can't use an embedded text subtitle until it is
  // extracted, so the trace must not report one as selected.
  it('does not select an unextracted embedded text subtitle', async () => {
    const { selection } = await trace([subtitle({ type: 'embedded' })]);

    expect(selection.selectedSubtitleStream).toBeNull();
    expect(selection.subtitleReason).toBe(
      'No subtitle stream satisfied rule "German"',
    );
  });

  // Regression test for https://github.com/chrisbenincasa/tunarr/issues/1960
  it('matches a bibliographic language against a terminological stream', async () => {
    const { selection } = await trace([
      subtitle({ type: 'external', index: 3, path: '/subs/de.srt' }),
    ]);

    expect(selection.selectedSubtitleStream?.index).toBe(3);
  });
});
