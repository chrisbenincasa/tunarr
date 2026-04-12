import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { FfprobeMediaInfo } from '@/types/ffmpeg.js';
import {
  getNowPlayingMetadata,
  getNowPlayingMetadataFromFfprobe,
  resolveNowPlayingOverlay,
} from './NowPlayingOverlay.ts';

function makeLineupItem(
  program: Partial<ContentBackedStreamLineupItem['program']> = {},
): ContentBackedStreamLineupItem {
  return {
    type: 'program',
    streamDuration: 180_000,
    duration: 180_000,
    programBeginMs: 0,
    infiniteLoop: false,
    program: {
      title: 'Song Title',
      artistName: 'Artist Name',
      albumName: 'Album Name',
      year: 1998,
      originalAirDate: null,
      sourceType: 'local',
      mediaSourceId: 'local-source',
      externalIds: [],
      ...program,
    },
  } as unknown as ContentBackedStreamLineupItem;
}

describe('NowPlayingOverlay', () => {
  describe('getNowPlayingMetadata', () => {
    test('reads title, artist, album, and year from the lineup item', () => {
      const metadata = getNowPlayingMetadata(makeLineupItem());
      expect(metadata).toEqual({
        title: 'Song Title',
        artist: 'Artist Name',
        album: 'Album Name',
        year: '1998',
      });
    });
  });

  describe('getNowPlayingMetadataFromFfprobe', () => {
    test('reads case-insensitive ffprobe tags and extracts a year', () => {
      const metadata = getNowPlayingMetadataFromFfprobe({
        format: {
          tags: {
            TITLE: 'Tagged Title',
            ALBUM_ARTIST: 'Tagged Artist',
          },
        },
        streams: [
          {
            tags: {
              album: 'Tagged Album',
              creation_time: '1997-05-04T12:00:00.000000Z',
            },
          },
        ],
      } as unknown as FfprobeMediaInfo);

      expect(metadata).toEqual({
        title: 'Tagged Title',
        artist: 'Tagged Artist',
        album: 'Tagged Album',
        year: '1997',
      });
    });
  });

  describe('resolveNowPlayingOverlay', () => {
    test('returns undefined when metadata is empty and no filepath', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: {},
        showForSeconds: 8,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });
      expect(overlay).toBeUndefined();
    });

    test('returns undefined when metadata contains only whitespace', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: '   \t  ', artist: '  ', album: '' },
        showForSeconds: 8,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });
      expect(overlay).toBeUndefined();
    });

    test('returns undefined when showForSeconds is 0 and no end window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 0,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });
      expect(overlay).toBeUndefined();
    });

    test('builds opening window adjusted by start offset', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title', artist: 'Artist' },
        showForSeconds: 8,
        startOffsetSeconds: 2.25,
        remainingDurationSeconds: 177.75,
      });

      expect(overlay!.title).toBe('Song Title');
      expect(overlay!.subtitle).toBe('Artist');
      expect(overlay!.windows[0]!.endSeconds).toBeCloseTo(5.75, 2);
    });

    test('skips overlay when viewer joins after the opening window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 6,
        startOffsetSeconds: 6,
        remainingDurationSeconds: 174,
      });
      expect(overlay).toBeUndefined();
    });

    test('adds a closing window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 6,
        showAtEndForSeconds: 8,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.windows).toHaveLength(2);
      expect(overlay!.windows[0]).toEqual({ startSeconds: 0, endSeconds: 6 });
      expect(overlay!.windows[1]).toEqual({
        startSeconds: 172,
        endSeconds: 180,
      });
    });

    test('skips closing window when it would overlap opening window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 6,
        showAtEndForSeconds: 8,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 5,
      });

      expect(overlay!.windows).toHaveLength(1);
      expect(overlay!.windows[0]!.endSeconds).toBe(5);
    });

    test('startPaddingSeconds delays the opening window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 8,
        startPaddingSeconds: 2,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.windows[0]).toEqual({
        startSeconds: 2,
        endSeconds: 10,
      });
    });

    test('endPaddingSeconds adds gap before program end', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 8,
        showAtEndForSeconds: 8,
        endPaddingSeconds: 2,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.windows[1]).toEqual({
        startSeconds: 170,
        endSeconds: 178,
      });
    });

    test('creates coming-up-next window when configured', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        nextMetadata: { title: 'Next Song', artist: 'Next Artist' },
        showForSeconds: 8,
        comingUpNextForSeconds: 6,
        comingUpNextOffsetSeconds: 30,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.nextTitle).toBe('Next Song');
      expect(overlay!.nextSubtitle).toBe('Next Artist');
      expect(overlay!.comingUpNextWindows).toEqual([
        { startSeconds: 150, endSeconds: 156 },
      ]);
    });

    test('uses next file metadata fallback for coming up next', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        nextMetadata: {
          artist: 'Next Artist',
          album: 'Next Album',
          year: '1995',
          filePath: "D:/music/No Doubt - Don't Speak (Official 4K Music Video) [No Doubt].mp4",
        },
        showForSeconds: 8,
        comingUpNextForSeconds: 6,
        comingUpNextOffsetSeconds: 30,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.nextTitle).toBe(
        "No Doubt - Don't Speak (Official 4K Music Video) [No Doubt]",
      );
      expect(overlay!.nextSubtitle).toBe('Next Artist - Next Album - 1995');
    });

    test('skips coming-up-next when comingUpNextForSeconds is 0', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        nextMetadata: { title: 'Next Song' },
        showForSeconds: 8,
        comingUpNextForSeconds: 0,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.comingUpNextWindows).toEqual([]);
    });

    test('skips coming-up-next when no next metadata', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 8,
        comingUpNextForSeconds: 6,
        comingUpNextOffsetSeconds: 30,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.comingUpNextWindows).toEqual([]);
    });

    test('skips coming-up-next when it would overlap closing window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        nextMetadata: { title: 'Next Song' },
        showForSeconds: 8,
        showAtEndForSeconds: 10,
        comingUpNextForSeconds: 6,
        comingUpNextOffsetSeconds: 15,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 60,
      });

      // coming-up-next would be 45-51, closing is 50-60 — overlap, so skipped
      expect(overlay!.comingUpNextWindows).toEqual([]);
    });

    test('skips coming-up-next when it would overlap opening window', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        nextMetadata: { title: 'Next Song' },
        showForSeconds: 8,
        comingUpNextForSeconds: 6,
        comingUpNextOffsetSeconds: 10,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 10,
      });

      expect(overlay!.comingUpNextWindows).toEqual([]);
    });

    test('defaults fadeDurationSeconds to 0.5', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 8,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.fadeDurationSeconds).toBe(0.5);
    });

    test('uses provided fadeDurationSeconds', () => {
      const overlay = resolveNowPlayingOverlay({
        metadata: { title: 'Song Title' },
        showForSeconds: 8,
        fadeDurationSeconds: 0.75,
        startOffsetSeconds: 0,
        remainingDurationSeconds: 180,
      });

      expect(overlay!.fadeDurationSeconds).toBe(0.75);
    });
  });
});
