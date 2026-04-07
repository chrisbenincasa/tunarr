import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { readTestFile } from '../../testing/util.ts';
import { HlsPlaylistMutator } from './HlsPlaylistMutator.ts';

describe('HlsPlaylistMutator', () => {
  const mutator = new HlsPlaylistMutator();

  const defaultOpts = {
    maxSegmentsToKeep: 10,
    endWithDiscontinuity: false,
    targetDuration: 4,
  };

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

      expect(result).toHaveLength(3);
      expect(result.every((item) => item.type === 'segment')).toBe(true);
    });

    it('should ignore discontinuity sequence header (FFmpeg artifact with hls_list_size=0)', () => {
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

      // Header DISC-SEQ is ignored — with hls_list_size=0 all DISCs are in the body.
      // Only the segment should be parsed, no DISC items.
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('segment');
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

      expect(result).toHaveLength(3);
      expect(result[0]?.type).toBe('segment');
      expect(result[1]?.type).toBe('discontinuity');
      expect(result[2]?.type).toBe('segment');
    });

    it('should add discontinuity at end when endWithDiscontinuity is true', () => {
      const lines = createPlaylist(2);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.parsePlaylist(start, lines, true);

      expect(result[result.length - 1]?.type).toBe('discontinuity');
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
      const discontinuities = result.filter(
        (item) => item.type === 'discontinuity',
      );
      expect(discontinuities).toHaveLength(1);
    });

    it('should ignore leading discontinuities in header (FFmpeg artifacts)', () => {
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

      // Header DISCs are FFmpeg artifacts from process restarts, not program boundaries
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('segment');
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

      const segments = result.filter((item) => item.type === 'segment');
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
        defaultOpts,
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
        { ...defaultOpts, maxSegmentsToKeep: 5 },
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
        defaultOpts,
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
        defaultOpts,
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
        { ...defaultOpts, maxSegmentsToKeep: 5 },
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
        defaultOpts,
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
        { ...defaultOpts, targetDuration: 6 },
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
        defaultOpts,
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
        { ...defaultOpts, maxSegmentsToKeep: 5 },
      );

      // playlistStart should be the start time of the first included segment
      expect(result.playlistStart.isValid()).toBe(true);
    });

    it('should include discontinuity sequence in output (header value ignored)', () => {
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
        defaultOpts,
      );

      // Header DISC-SEQ is ignored, so output should be 0 (no body DISCs)
      expect(result.playlist).toContain('#EXT-X-DISCONTINUITY-SEQUENCE:0');
    });

    it('should include independent segments tag', () => {
      const lines = createPlaylist(3);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      const result = mutator.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        defaultOpts,
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
        defaultOpts,
      );

      // Should still have maxSegmentsToKeep segments by taking from the end
      expect(result.segmentCount).toBe(10);
    });
  });

  describe('bug fixes', () => {
    it('should not mutate options between calls', () => {
      const mutator1 = new HlsPlaylistMutator();
      const mutator2 = new HlsPlaylistMutator();
      const lines = createPlaylist(15);
      const start = dayjs('2024-10-18T14:00:00.000-0400');

      // First call with custom maxSegmentsToKeep
      const result1 = mutator1.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        { ...defaultOpts, maxSegmentsToKeep: 3 },
      );

      // Second call with default maxSegmentsToKeep of 10
      const result2 = mutator2.trimPlaylist(
        start,
        { type: 'before_date', before: start },
        lines,
        defaultOpts,
      );

      expect(result1.segmentCount).toBe(3);
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
        defaultOpts,
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
        defaultOpts,
      );

      // BUG: Regex [ts|mp4] is a character class, not alternation
      // It matches 't' from '.mp4' at position 3, not the full extension
      // The sequence should be 5, extracted from 'data00005.mp4'
      expect(result.sequence).toBe(5);
    });

    it('should ignore header discontinuities — disc-seq stays 0', () => {
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
        defaultOpts,
      );

      // Header DISCs are ignored — they are FFmpeg artifacts, not program boundaries.
      // disc-seq should be 0 since no body DISCs exist.
      expect(result.playlist).toContain('#EXT-X-DISCONTINUITY-SEQUENCE:0');
    });
  });

  describe('discontinuity sequence calculation', () => {
    // Playlist: 31 old-program segments (0–30), one DISC, 30 new-program
    // segments (31–60). Total 61 segments, all numbered with 6 digits.
    function createTransitionPlaylist(): string[] {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      ];
      for (let i = 0; i < 31; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
          `/stream/channels/test-channel/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      for (let i = 31; i <= 60; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:02:04.000-0400',
          `/stream/channels/test-channel/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      return lines;
    }

    const start = dayjs('2024-10-18T14:00:00.000-0400');

    function trimWithSegmentFilter(
      segmentNumber: number,
      segmentsToKeepBefore = 10,
    ) {
      return mutator.trimPlaylist(
        start,
        { type: 'before_segment_number', segmentNumber, segmentsToKeepBefore },
        createTransitionPlaylist(),
        { ...defaultOpts, maxSegmentsToKeep: 20 },
      );
    }

    function discSeq(playlist: string): number {
      const m = playlist.match(/#EXT-X-DISCONTINUITY-SEQUENCE:(\d+)/);
      return m ? parseInt(m[1]!) : -1;
    }

    function discTagCount(playlist: string): number {
      return playlist.split('\n').filter((l) => l === '#EXT-X-DISCONTINUITY')
        .length;
    }

    it('DISC in middle of selected window: disc-seq=0, DISC tag emitted', () => {
      // minSeg = max(25-10, 0) = 15 → filtered segs 15..60 (46 >= 20) → take first 20 = segs 15..34
      // DISC between seg30 and seg31; seg31 IS in window → tag emitted, no counting
      const result = trimWithSegmentFilter(25);
      expect(discSeq(result.playlist)).toBe(0);
      expect(discTagCount(result.playlist)).toBe(1);
    });

    it('DISC immediately before first selected segment: folded into disc-seq, no tag emitted', () => {
      // minSeg = max(41-10, 0) = 31 → filtered segs 31..60 (30 >= 20) → take first 20 = segs 31..50
      // DISC is immediately before seg31 (first selected segment).
      // Since there are no selected segments BEFORE the DISC, it must NOT be
      // emitted as a tag (that would create an empty leading period which
      // breaks Kodi's inputstream.adaptive). Instead it is folded into the
      // discontinuity sequence number.
      const result = trimWithSegmentFilter(41);
      expect(discSeq(result.playlist)).toBe(1);
      expect(discTagCount(result.playlist)).toBe(0);
    });

    it('DISC before window with a gap: disc-seq=1, DISC tag NOT emitted', () => {
      // minSeg = max(45-10, 0) = 35 → filtered segs 35..60 (26 >= 20) → take first 20 = segs 35..54
      // DISC before seg31; seg31 not in window → DISC counted in sequence, not emitted
      const result = trimWithSegmentFilter(45);
      expect(discSeq(result.playlist)).toBe(1);
      expect(discTagCount(result.playlist)).toBe(0);
    });

    it('disc-seq is monotonically non-decreasing as the DISC rolls off the window', () => {
      // Simulates three consecutive playlist polls as the client advances
      const poll1 = trimWithSegmentFilter(25); // DISC in middle of window
      const poll2 = trimWithSegmentFilter(41); // DISC before first selected (no segs before it)
      const poll3 = trimWithSegmentFilter(45); // DISC before window with gap

      const seq1 = discSeq(poll1.playlist);
      const seq2 = discSeq(poll2.playlist);
      const seq3 = discSeq(poll3.playlist);

      expect(seq1).toBe(0);
      expect(seq2).toBe(1); // DISC folded into disc-seq (no selected segs before it)
      expect(seq3).toBe(1);
      expect(seq2).toBeGreaterThanOrEqual(seq1);
      expect(seq3).toBeGreaterThanOrEqual(seq2);
    });

    it('multiple DISCs: all before first selected segment are folded into disc-seq', () => {
      // Three programs:
      //   prog1: segs 0–14  (15 segs)
      //   DISC1
      //   prog2: segs 15–29 (15 segs)
      //   DISC2
      //   prog3: segs 30–60 (31 segs)
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      ];
      for (let i = 0; i < 15; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
          `/stream/channels/test-channel/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      for (let i = 15; i < 30; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:01:00.000-0400',
          `/stream/channels/test-channel/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      for (let i = 30; i <= 60; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:02:00.000-0400',
          `/stream/channels/test-channel/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }

      // minSeg = max(40-10, 0) = 30 → filtered segs 30..60 (31 >= 20) → take first 20 = segs 30..49
      // Both DISC1 and DISC2 are before the first selected segment (seg30).
      // Neither has selected segments before it, so both are folded into disc-seq.
      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 40,
          segmentsToKeepBefore: 10,
        },
        lines,
        {
          ...defaultOpts,
          maxSegmentsToKeep: 20,
          previousDiscontinuitySequence: 1,
        },
      );

      expect(discSeq(result.playlist)).toBe(2); // DISC1 + DISC2 both counted
      expect(discTagCount(result.playlist)).toBe(0); // no tags emitted
    });
  });

  describe('Kodi empty period regression', () => {
    // Reproduces the bug where a DISC tag before the first selected segment
    // creates an empty leading period, causing Kodi's inputstream.adaptive
    // to error with "No segments in the manifest".
    const mutator = new HlsPlaylistMutator();
    const start = dayjs('2024-10-18T14:00:00.000-0400');

    // Simulates a long-running channel: Program A (675 segments ≈ 45min)
    // followed by Program B. The sliding window eventually moves past all
    // of A's segments.
    function createLongPlaylist(): string[] {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      ];
      // Program A: 50 segments (0-49)
      for (let i = 0; i < 50; i++) {
        lines.push(
          '#EXTINF:4.000000,',
          `#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:${String(i * 4).padStart(2, '0')}.000-0400`,
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      // Program B: 30 segments (50-79)
      for (let i = 50; i < 80; i++) {
        lines.push(
          '#EXTINF:4.000000,',
          `#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:03:${String((i - 50) * 4).padStart(2, '0')}.000-0400`,
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      return lines;
    }

    function trim(segmentNumber: number) {
      return mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber,
          segmentsToKeepBefore: 10,
        },
        createLongPlaylist(),
        { ...defaultOpts, maxSegmentsToKeep: 20 },
      );
    }

    function discSeq(playlist: string): number {
      const m = playlist.match(/#EXT-X-DISCONTINUITY-SEQUENCE:(\d+)/);
      return m ? parseInt(m[1]!) : -1;
    }

    function discTagCount(playlist: string): number {
      return playlist.split('\n').filter((l) => l === '#EXT-X-DISCONTINUITY')
        .length;
    }

    function firstSegmentNum(playlist: string): number {
      const m = playlist.match(/data(\d{6})\.ts/);
      return m ? parseInt(m[1]!) : -1;
    }

    it('window spanning the boundary: DISC between selected segments is emitted as tag', () => {
      // Client at seg 45: window includes both A and B segments
      const result = trim(45);
      expect(discSeq(result.playlist)).toBe(0);
      expect(discTagCount(result.playlist)).toBe(1);
      expect(result.playlist).toContain('data000049.ts'); // last of A
      expect(result.playlist).toContain('data000050.ts'); // first of B
    });

    it('window just past the boundary: DISC folded into disc-seq, NOT emitted as tag', () => {
      // Client at seg 60: first selected is seg50 (first of B).
      // The DISC is before seg50 with no selected A segments before it.
      // CRITICAL: must NOT emit DISC tag (would create empty period 0).
      const result = trim(60);
      expect(discSeq(result.playlist)).toBe(1);
      expect(discTagCount(result.playlist)).toBe(0);
      expect(firstSegmentNum(result.playlist)).toBe(50);
    });

    it('window well past the boundary: DISC folded into disc-seq', () => {
      const result = trim(70);
      expect(discSeq(result.playlist)).toBe(1);
      expect(discTagCount(result.playlist)).toBe(0);
      expect(firstSegmentNum(result.playlist)).toBe(60);
    });

    it('no empty periods across the full transition', () => {
      // Simulate the full client progression across the program boundary.
      // At every point, the first period must have at least one segment.
      const polls = [40, 45, 50, 55, 60, 65, 70];
      for (const seg of polls) {
        const result = trim(seg);
        const lines = result.playlist.split('\n');
        const headerEnd = lines.findIndex(
          (l) => l.startsWith('#EXTINF:') || l === '#EXT-X-DISCONTINUITY',
        );
        const firstContentLine = lines[headerEnd];

        if (firstContentLine === '#EXT-X-DISCONTINUITY') {
          // If there's a leading DISC tag, that means period has no segments
          throw new Error(
            `Poll at seg=${seg}: manifest starts with DISC tag, creating empty period. ` +
              `DISC-SEQ=${discSeq(result.playlist)}`,
          );
        }
      }
    });
  });

  describe('disc-seq capping', () => {
    const start = dayjs('2024-10-18T14:00:00.000-0400');

    // Three programs: A (15 segs), B (5 segs), C (30 segs)
    function createThreeProgramPlaylist(): string[] {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
      ];
      // Program A: segs 0-14
      for (let i = 0; i < 15; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      // Program B: segs 15-19
      for (let i = 15; i < 20; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:01:00.000-0400',
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      // Program C: segs 20-49
      for (let i = 20; i < 50; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:02:00.000-0400',
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      return lines;
    }

    function discSeq(playlist: string): number {
      const m = playlist.match(/#EXT-X-DISCONTINUITY-SEQUENCE:(\d+)/);
      return m ? parseInt(m[1]!) : -1;
    }

    function discTagCount(playlist: string): number {
      return playlist.split('\n').filter((l) => l === '#EXT-X-DISCONTINUITY')
        .length;
    }

    function hasTrailingDisc(playlist: string): boolean {
      const lines = playlist.split('\n').filter((l) => l.length > 0);
      return lines[lines.length - 1] === '#EXT-X-DISCONTINUITY';
    }

    it('disc-seq capped when it would jump by more than 1', () => {
      // Filter to only C segments: minSeg = max(35-10,0)=25, segs 25-49 (25 segs >= 20) → take 20 = 25-44
      // Both DISC1 (before B) and DISC2 (before C) are before first selected seg.
      // Without cap: disc-seq = 2. With previousDiscontinuitySequence=0: cap to 1, trailing DISC emitted.
      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 35,
          segmentsToKeepBefore: 10,
        },
        createThreeProgramPlaylist(),
        {
          ...defaultOpts,
          maxSegmentsToKeep: 20,
          previousDiscontinuitySequence: 0,
        },
      );

      expect(discSeq(result.playlist)).toBe(1);
      expect(result.discontinuitySequence).toBe(1);
      expect(hasTrailingDisc(result.playlist)).toBe(true);
    });

    it('gradual disc-seq catch-up over multiple polls', () => {
      const playlist = createThreeProgramPlaylist();

      // Poll 1: previousDiscontinuitySequence=0 with natural disc-seq=2 → cap to 1
      const poll1 = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 35,
          segmentsToKeepBefore: 10,
        },
        playlist,
        {
          ...defaultOpts,
          maxSegmentsToKeep: 20,
          previousDiscontinuitySequence: 0,
        },
      );

      expect(discSeq(poll1.playlist)).toBe(1);
      expect(hasTrailingDisc(poll1.playlist)).toBe(true);

      // Poll 2: previous=1 → disc-seq=2, no cap needed, no trailing DISC
      const poll2 = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 35,
          segmentsToKeepBefore: 10,
        },
        playlist,
        {
          ...defaultOpts,
          maxSegmentsToKeep: 20,
          previousDiscontinuitySequence: poll1.discontinuitySequence,
        },
      );
      expect(discSeq(poll2.playlist)).toBe(2);
      expect(hasTrailingDisc(poll2.playlist)).toBe(false);
    });

    it('no trailing DISC when disc-seq does not need capping', () => {
      // Single program transition (0→1): no cap needed
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
      ];
      for (let i = 0; i < 30; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:00:00.000-0400',
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }
      lines.push('#EXT-X-DISCONTINUITY');
      for (let i = 30; i < 60; i++) {
        lines.push(
          '#EXTINF:4.004000,',
          '#EXT-X-PROGRAM-DATE-TIME:2024-10-18T14:02:00.000-0400',
          `/stream/channels/test/hls/data${String(i).padStart(6, '0')}.ts`,
        );
      }

      // Window past the DISC: disc-seq=1, previous=0 → increase is exactly 1, no cap
      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 45,
          segmentsToKeepBefore: 10,
        },
        lines,
        {
          ...defaultOpts,
          maxSegmentsToKeep: 20,
          previousDiscontinuitySequence: 0,
        },
      );

      expect(discSeq(result.playlist)).toBe(1);
      expect(hasTrailingDisc(result.playlist)).toBe(false);
    });
  });

  describe('high-water mark floor protection', () => {
    // These tests verify the invariant that HlsSession's #highestDeletedBelow
    // relies on: the before_segment_number filter acts as a hard floor, so the
    // playlist never references segments below (segmentNumber - segmentsToKeepBefore).

    const start = dayjs('2024-10-18T14:00:00.000-0400');
    const largeOpts = { ...defaultOpts, maxSegmentsToKeep: 20 };

    it('Scenario B: segmentNumber=0 (empty _minByIp) selects segments from the start', () => {
      // Without the high-water mark fix, stale cleanup empties _minByIp and
      // minSegmentRequested returns 0. This causes trimPlaylist to serve segments
      // from the very beginning of the playlist — all of which have been deleted.
      // This test documents the behavior that #highestDeletedBelow prevents.
      const lines = createPlaylist(100);

      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 0,
          segmentsToKeepBefore: 10,
        },
        lines,
        largeOpts,
      );

      // minSeg = max(0-10, 0) = 0 → all 100 segments pass the filter (≥20) → take first 20 = segs 0..19
      expect(result.playlist).toContain('data000000.ts');
      expect(result.playlist).toContain('data000019.ts');
      expect(result.playlist).not.toContain('data000020.ts');
    });

    it('Scenario B fix: high-water mark as segmentNumber floors the playlist above deleted range', () => {
      // After deleteOldSegments(190), #highestDeletedBelow = 190.
      // Math.max(minSegmentRequested=0, highestDeletedBelow=190) = 190 is used
      // as segmentNumber, so the playlist starts at 180 (190 - keepBefore:10)
      // rather than 0, avoiding any reference to deleted segments.
      const lines = createPlaylist(300);

      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 190,
          segmentsToKeepBefore: 10,
        },
        lines,
        largeOpts,
      );

      // minSeg = max(190-10, 0) = 180; segs 180..299 (120 ≥ 20) → take first 20 = segs 180..199
      expect(result.playlist).toContain('data000180.ts');
      expect(result.playlist).toContain('data000199.ts');
      expect(result.playlist).not.toContain('data000179.ts');
      expect(result.playlist).not.toContain('data000000.ts');
    });

    it('Scenario A: stale client removal jump still floors above deleted range', () => {
      // Client A was at seg 100, stale cleanup removes it, leaving Client B at seg 200.
      // deleteOldSegments(190) ran, so #highestDeletedBelow = 190.
      // Math.max(minSegmentRequested=200, highestDeletedBelow=190) = 200.
      // Playlist must not include segments below 190 (200 - keepBefore:10).
      const lines = createPlaylist(300);

      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 200,
          segmentsToKeepBefore: 10,
        },
        lines,
        largeOpts,
      );

      // minSeg = max(200-10, 0) = 190; segs 190..299 (110 ≥ 20) → take first 20 = segs 190..209
      expect(result.playlist).toContain('data000190.ts');
      expect(result.playlist).toContain('data000209.ts');
      expect(result.playlist).not.toContain('data000189.ts');
      expect(result.playlist).not.toContain('data000100.ts');
    });

    it('floor does not over-trim when segmentNumber equals the live edge', () => {
      // When #highestDeletedBelow and minSegmentRequested agree (normal single-client case),
      // the playlist should include the last keepBefore segments before the current position.
      const lines = createPlaylist(50);

      const result = mutator.trimPlaylist(
        start,
        {
          type: 'before_segment_number',
          segmentNumber: 30,
          segmentsToKeepBefore: 10,
        },
        lines,
        largeOpts,
      );

      // minSeg = max(30-10, 0) = 20; segs 20..49 (30 ≥ 20) → take first 20 = segs 20..39
      expect(result.playlist).toContain('data000020.ts');
      expect(result.playlist).toContain('data000039.ts');
      expect(result.playlist).not.toContain('data000019.ts');
      expect(result.segmentCount).toBe(20);
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
        { ...defaultOpts, endWithDiscontinuity: true },
      );

      expect(result.segmentCount).toBeLessThanOrEqual(10);
      expect(result.playlist).toContain('#EXTM3U');
      expect(result.sequence).toBeGreaterThanOrEqual(0);
    });

    it('should ignore leading discontinuities from test file (FFmpeg artifacts)', async () => {
      const lines = (await readTestFile('test.m3u8'))
        .toString('utf-8')
        .split('\n');
      const start = dayjs('2024-10-18T13:58:31.127-0400');

      const parsed = mutator.parsePlaylist(start, lines, false);

      // The test file has 2 leading discontinuities in the header — these are
      // FFmpeg artifacts and should be ignored. First item should be a segment.
      expect(parsed[0]?.type).toBe('segment');
    });
  });
});
