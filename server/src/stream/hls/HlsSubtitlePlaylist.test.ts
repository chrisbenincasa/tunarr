import {
  firstNeededCueFile,
  parseCues,
  segmentWindows,
  subtitlePlaylistFromVideo,
  subtitleWindowVtt,
} from './HlsSubtitlePlaylist.ts';

const video = [
  '#EXTM3U',
  '#EXT-X-VERSION:6',
  '#EXT-X-TARGETDURATION:4',
  '#EXT-X-MEDIA-SEQUENCE:0',
  '#EXTINF:4.004000,',
  '#EXT-X-PROGRAM-DATE-TIME:2026-09-29T08:00:00.000-0400',
  '/stream/sessions/abc/hls/data000000.ts',
  '#EXTINF:3.500000,',
  '#EXT-X-PROGRAM-DATE-TIME:2026-09-29T08:00:04.004-0400',
  '/stream/sessions/abc/hls/data000001.ts',
  '#EXT-X-DISCONTINUITY',
  '#EXTINF:4.000000,',
  '#EXT-X-PROGRAM-DATE-TIME:2026-09-29T08:00:07.504-0400',
  '/stream/sessions/abc/hls/data000002.ts',
].join('\n');

describe('HlsSubtitlePlaylist', () => {
  test('mirrors every video segment so the subtitle timeline has no gaps', () => {
    const subs = subtitlePlaylistFromVideo(video).split('\n');
    expect(subs).toContain('/stream/sessions/abc/hls/subs000000.vtt');
    expect(subs).toContain('/stream/sessions/abc/hls/subs000002.vtt');
    expect(subs).toContain('#EXT-X-DISCONTINUITY');
    expect(subs).toContain('#EXTINF:3.500000,');
    expect(subs.some((line) => line.endsWith('.ts'))).toBe(false);
  });

  test('computes each segment window from session start', () => {
    const windows = segmentWindows(video);
    expect(windows.get(0)).toEqual([0, 4.004]);
    expect(windows.get(1)).toEqual([4.004, 7.504]);
    expect(windows.get(2)?.[0]).toBeCloseTo(7.504);
  });

  test('puts each cue in the window where it starts', () => {
    const cues = parseCues(
      'WEBVTT\n\n00:04.500 --> 00:06.000\nHello\n\n01:00:05.000 --> 01:00:06.000\nLater\n',
    );
    expect(cues.map((cue) => cue.start)).toEqual([4.5, 3605]);

    const vtt = subtitleWindowVtt(cues, 4.004, 7.504);
    expect(vtt).toContain('00:04.500 --> 00:06.000\nHello');
    expect(vtt).not.toContain('Later');
    expect(vtt.startsWith('WEBVTT\n')).toBe(true);
  });

  test('keeps cue files from the oldest window still being served', () => {
    const files = new Map([
      [3, parseCues('WEBVTT\n\n00:01.000 --> 00:02.000\nOld\n')],
      [4, parseCues('WEBVTT\n\n00:09.000 --> 00:10.000\nEdge\n')],
      [5, parseCues('WEBVTT\n\n00:20.000 --> 00:21.000\nNew\n')],
    ]);
    expect(firstNeededCueFile(files, 8)).toBe(4);
    expect(firstNeededCueFile(files, 30)).toBeUndefined();
  });
});
