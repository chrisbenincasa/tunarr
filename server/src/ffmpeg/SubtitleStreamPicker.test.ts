import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { ChannelSubtitlePreferences } from '../db/schema/SubtitlePreferences.ts';
import type { SubtitleStreamDetails } from '../stream/types.ts';
import { SubtitleStreamPicker } from './SubtitleStreamPicker.ts';

vi.mock('@/util/logging/LoggerFactory.js', () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    setBindings: vi.fn(),
  };
  return {
    LoggerFactory: {
      isInitialized: true,
      root: logger,
      child: () => logger,
    },
  };
});

vi.mock('../globals.ts', () => ({
  globalOptions: () => ({ databaseDirectory: '/tmp/test-tunarr' }),
}));

const mockFileExists = vi.fn();
vi.mock('../util/fsUtil.ts', () => ({
  fileExists: (...args: unknown[]) => mockFileExists(...args),
}));

function makeLineupItem(): ContentBackedStreamLineupItem {
  return {
    type: 'program',
    streamDuration: 30000,
    programBeginMs: 0,
    duration: 30000,
    infiniteLoop: false,
    program: {
      uuid: 'program-uuid',
      externalKey: 'ext-key-1',
      mediaSourceId: 'source-1',
      sourceType: 'plex',
      externalIds: [],
    },
  } as ContentBackedStreamLineupItem;
}

describe('SubtitleStreamPicker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSubtitleDetailsWithExtractedPath', () => {
    it('should return type "external" with index 0 when a cached extraction exists for an embedded subtitle', async () => {
      // Simulate an embedded subtitle at stream index 2 in the source container
      const embeddedStream: SubtitleStreamDetails = {
        type: 'embedded',
        codec: 'subrip',
        index: 2,
        default: true,
        forced: false,
        sdh: false,
        language: 'English',
        languageCodeISO6392: 'eng',
        title: 'English SRT',
      };

      // The cached .srt exists on disk
      mockFileExists.mockResolvedValue(true);

      const result =
        await SubtitleStreamPicker.getSubtitleDetailsWithExtractedPath(
          makeLineupItem(),
          embeddedStream,
        );

      expect(result).toBeDefined();
      // The extracted .srt is a standalone file with a single stream at index 0.
      // The type must switch to 'external' so the pipeline builder creates an
      // ExternalSubtitleStream (which hardcodes index 0) instead of an
      // EmbeddedSubtitleStream (which would carry the original container index).
      expect(result!.type).toBe('external');
      expect(result!.index).toBe(0);
      // The path should be updated to the cached file
      expect(result!.path).toMatch(/\.srt$/);
    });
  });
});

// ISO 639-2 assigns 20 languages both a bibliographic (/B) code and a
// terminological (/T) code — German is both "ger" and "deu". A stored
// subtitle preference in one code set must match a stream tagged in the other.
// Regression test for https://github.com/chrisbenincasa/tunarr/issues/1960
describe('SubtitleStreamPicker language matching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makePreference(languageCode: string): ChannelSubtitlePreferences {
    return {
      uuid: 'pref-1',
      channelId: 'channel-1',
      languageCode,
      priority: 0,
      allowImageBased: true,
      allowExternal: true,
      filterType: 'any',
    };
  }

  function makeSubtitle(
    index: number,
    languageCodeISO6392: string,
  ): SubtitleStreamDetails {
    return {
      // External so the picker returns it without touching the extraction cache
      type: 'external',
      codec: 'subrip',
      index,
      default: false,
      forced: false,
      sdh: false,
      languageCodeISO6392,
      path: `/subs/${languageCodeISO6392}.srt`,
    };
  }

  it.each([
    ['ger', 'deu'],
    ['deu', 'ger'],
    ['de', 'deu'],
    ['de', 'ger'],
  ])(
    'matches a preference of %s against a stream tagged %s',
    async (preferenceCode, streamCode) => {
      const result = await SubtitleStreamPicker.pickSubtitles(
        [makePreference(preferenceCode)],
        makeLineupItem(),
        [makeSubtitle(1, streamCode), makeSubtitle(2, 'eng')],
      );

      expect(result?.index).toBe(1);
    },
  );

  it('does not match an unrelated language', async () => {
    const result = await SubtitleStreamPicker.pickSubtitles(
      [makePreference('ger')],
      makeLineupItem(),
      [makeSubtitle(1, 'eng'), makeSubtitle(2, 'nld')],
    );

    expect(result).toBeUndefined();
  });

  it('respects preference priority across code sets', async () => {
    const result = await SubtitleStreamPicker.pickSubtitles(
      [
        { ...makePreference('eng'), uuid: 'pref-1', priority: 0 },
        { ...makePreference('ger'), uuid: 'pref-2', priority: 1 },
      ],
      makeLineupItem(),
      [makeSubtitle(1, 'deu'), makeSubtitle(2, 'eng')],
    );

    expect(result?.index).toBe(2);
  });
});
