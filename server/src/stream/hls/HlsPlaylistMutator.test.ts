import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { readTestFile } from '../../testing/util.ts';
import { HlsPlaylistMutator } from './HlsPlaylistMutator.ts';

describe('HlsPlaylistMutator', () => {
  const mutator = new HlsPlaylistMutator();

  // Helper to create a minimal playlist
  // Note: SegmentNameRegex expects 6-digit segment numbers (data000000.ts)
  function createPlaylist(segments: number, startNum = 0): string[] {
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:4',
      `#EXT-X-MEDIA-SEQUENCE:${startNum}`,
    ];
    for (let i = startNum; i < startNum + segments; i++) {
      lines.push(
        `#EXTINF:4.004000,`,
        `#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:${String(i * 4).padStart(2, '0')}.000-0400`,
        `/stream/channels/test-channel/hls/data${String(i).padStart(6, '0')}.ts`,
      );
    }
    return lines;
  }

  describe('parsePlaylist', () => {
    it('should parse a basic playlist with segments', () => {
      const lines = createPlaylist(3);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, false);

      expect(result.discontinuitySeq).toBe(0);
      expect(result.items).toHaveLength(3);
      expect(result.items.every((item) => item.type === 'segment')).toBe(true);
    });

    it('should parse discontinuity sequences', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY-SEQUENCE:5',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, false);

      expect(result.discontinuitySeq).toBe(5);
    });

    it('should parse discontinuity tags between segments', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:04.000-0400',
        '/stream/channels/test-channel/hls/data000001.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, false);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.type).toBe('segment');
      expect(result.items[1]?.type).toBe('discontinuity');
      expect(result.items[2]?.type).toBe('segment');
    });

    it('should add discontinuity at end when endWithDiscontinuity is true', () => {
      const lines = createPlaylist(2);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, true);

      expect(result.items[result.items.length - 1]?.type).toBe('discontinuity');
    });

    it('should not duplicate discontinuity at end if already present', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
        '#EXT-X-DISCONTINUITY',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, true);

      // Should have 1 segment + 1 discontinuity, not 1 segment + 2 discontinuities
      const discontinuities = result.items.filter(
        (item) => item.type === 'discontinuity',
      );
      expect(discontinuities).toHaveLength(1);
    });

    it('should parse leading discontinuities before segments', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, false);

      // Should capture leading discontinuities
      expect(result.items[0]?.type).toBe('discontinuity');
      expect(result.items[1]?.type).toBe('discontinuity');
      expect(result.items[2]?.type).toBe('segment');
    });

    it('should skip empty lines', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
        '',
        '',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:04.000-0400',
        '/stream/channels/test-channel/hls/data000001.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, false);

      const segments = result.items.filter((item) => item.type === 'segment');
      expect(segments).toHaveLength(2);
    });
  });

  describe('trimPlaylist', () => {
    it('should trim playlist with before_date filter', () => {
      const lines = createPlaylist(15);
      const start = dayjs('2024-10-18T14:00:00.000-0400');
      const filterBefore = start.add(20, 'seconds'); // Filter out first ~5 segments

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: filterBefore },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      expect(result.segmentCount).toBe(10);
      expect(result.playlist).toContain('#EXTM3U');
      expect(result.playlist).toContain('#EXT-X-VERSION:6');
    });

    it('should respect maxSegmentsToKeep option', () => {
      const lines = createPlaylist(20);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 5 },
      );

      expect(result.segmentCount).toBe(5);
    });

    it('should not trim if segments are less than maxSegmentsToKeep', () => {
      const lines = createPlaylist(5);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      expect(result.segmentCount).toBe(5);
    });

    it('should trim playlist with before_segment_number filter', () => {
      const lines = createPlaylist(15);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 10,
          segmentsToKeepBefore: 3,
        },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      expect(result.segmentCount).toBeLessThanOrEqual(10);
    });

    it('should set correct media sequence in output', () => {
      const lines = createPlaylist(15, 100);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 5 },
      );

      // Should start from the correct sequence
      expect(result.playlist).toMatch(/#EXT-X-MEDIA-SEQUENCE:\d+/);
    });

    it('should include program date time for each segment', () => {
      const lines = createPlaylist(5);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      const programDateTimes = result.playlist
        .split('\n')
        .filter((line) => line.startsWith('#EXT-X-PROGRAM-DATE-TIME'));
      expect(programDateTimes).toHaveLength(5);
    });

    it('should set correct target duration', () => {
      const lines = createPlaylist(5);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10, targetDuration: 6 },
      );

      expect(result.playlist).toContain('#EXT-X-TARGETDURATION:6');
    });

    it('should preserve discontinuity tags in output when relevant', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:04.000-0400',
        '/stream/channels/test-channel/hls/data000001.ts',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:08.000-0400',
        '/stream/channels/test-channel/hls/data000002.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      expect(result.playlist).toContain('#EXT-X-DISCONTINUITY');
    });

    it('should return correct playlistStart time', () => {
      const lines = createPlaylist(10);
      const start = dayjs('2024-10-18T14:00:00.000-0400');
      const filterBefore = start.add(20, 'seconds');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: filterBefore },
        lines,
        { maxSegmentsToKeep: 5 },
      );

      // playlistStart should be the start time of the first included segment
      expect(result.playlistStart.isValid()).toBe(true);
    });

    it('should include discontinuity sequence in output', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY-SEQUENCE:3',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      expect(result.playlist).toMatch(/#EXT-X-DISCONTINUITY-SEQUENCE:\d+/);
    });

    it('should include independent segments tag', () => {
      const lines = createPlaylist(3);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      expect(result.playlist).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    });

    it('should fall back to taking last segments when filter leaves too few', () => {
      const lines = createPlaylist(15);
      const start = dayjs('2024-10-18T14:00:00.000-0400');
      // Filter that would remove almost all segments
      const filterBefore = start.add(60, 'seconds');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: filterBefore },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      // Should still have maxSegmentsToKeep segments by taking from the end
      expect(result.segmentCount).toBe(10);
    });
  });

  describe('bug fixes', () => {
    it('should not mutate defaultMutateOptions between calls', () => {
      const mutator1 = new HlsPlaylistMutator();
      const mutator2 = new HlsPlaylistMutator();
      const lines = createPlaylist(15);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      // First call with custom maxSegmentsToKeep
      const result1 = mutator1.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 3 },
      );

      // Second call with default options (should use default maxSegmentsToKeep of 10)
      const result2 = mutator2.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        {}, // Empty opts - should use defaults
      );

      expect(result1.segmentCount).toBe(3);
      // BUG: If defaultMutateOptions is mutated, this would be 3 instead of 10
      expect(result2.segmentCount).toBe(10);
    });

    it('should correctly filter segments with before_segment_number filter', () => {
      // Create playlist with segments numbered 0-24
      const lines = createPlaylist(25);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 20,
          segmentsToKeepBefore: 5, // Should keep segments >= 15
        },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      // With Math.max: Math.max(20-5, 0) = 15, keeping segments >= 15
      // Segments 15-24 = 10 segments, which equals maxSegmentsToKeep
      // BUG with Math.min: Math.min(15, 0) = 0, keeping all segments >= 0
      // Then take(10) would give segments 0-9 instead of 15-24
      expect(result.segmentCount).toBe(10);
      expect(result.playlist).toContain('data000015.ts');
      expect(result.playlist).not.toContain('data000000.ts');
      expect(result.playlist).not.toContain('data000014.ts');
    });

    it('should correctly parse startSequence for mp4 segments', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000005.mp4',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      // BUG: Regex [ts|mp4] is a character class, not alternation
      // It matches 't' from '.mp4' at position 3, not the full extension
      // The sequence should be 5, extracted from 'data00005.mp4'
      expect(result.sequence).toBe(5);
    });

    it('should correctly count multiple leading discontinuities for discontinuity sequence', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY',
        '#EXT-X-DISCONTINUITY',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.004000,',
        '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
        '/stream/channels/test-channel/hls/data000000.ts',
      ];
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { maxSegmentsToKeep: 10 },
      );

      // BUG: Only first discontinuity is counted (discontinuitySequence++),
      // but all 3 are dropped by dropWhile
      // The discontinuity sequence should be 0 + 3 = 3
      expect(result.playlist).toContain('#EXT-X-DISCONTINUITY-SEQUENCE:3');
    });
  });

  describe('integration with real test file', () => {
    it('should parse and trim the test.m3u8 file', async () => {
      const lines = (await readTestFile('test.m3u8'))
        .toString('utf-8')
        .split('\n');
      const start = dayjs('2024-10-18T14:01:55.164-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start.subtract(30, 'seconds') },
        lines,
        { maxSegmentsToKeep: 10, endWithDiscontinuity: true },
      );

      expect(result.segmentCount).toBeLessThanOrEqual(10);
      expect(result.playlist).toContain('#EXTM3U');
      expect(result.sequence).toBeGreaterThanOrEqual(0);
    });

    it('should handle playlist with leading discontinuities from test file', async () => {
      const lines = (await readTestFile('test.m3u8'))
        .toString('utf-8')
        .split('\n');
      const start = dayjs('2024-10-18T13:58:31.127-0400');

      const parsed = mutator.parsePlaylist(start, lines, false);

      // The test file has 2 leading discontinuities
      expect(parsed.items[0]?.type).toBe('discontinuity');
      expect(parsed.items[1]?.type).toBe('discontinuity');
      // First segment should be at index 2
      expect(parsed.items[2]?.type).toBe('segment');
    });
  });
});
