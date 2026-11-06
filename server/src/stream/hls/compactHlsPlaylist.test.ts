import { describe, expect, it } from 'vitest';
import { compactHlsPlaylist } from './compactHlsPlaylist.ts';

function segment(n: number, duration = '4.000000') {
  return [
    `#EXTINF:${duration},`,
    '#EXT-X-PROGRAM-DATE-TIME:2026-01-01T00:00:00.000+0000',
    `/stream/channels/c/hls/data${String(n).padStart(6, '0')}.ts`,
  ];
}

const header = [
  '#EXTM3U',
  '#EXT-X-VERSION:6',
  '#EXT-X-TARGETDURATION:4',
  '#EXT-X-MEDIA-SEQUENCE:0',
];

describe('compactHlsPlaylist', () => {
  it('drops segments below the cutoff and rewrites the media sequence', () => {
    const lines = [
      ...header,
      ...segment(0, '4.004000'),
      ...segment(1, '3.200000'),
      ...segment(2),
      ...segment(3),
      '',
    ];

    const result = compactHlsPlaylist(lines, 2);

    expect(result).toEqual({
      lines: [
        '#EXTM3U',
        '#EXT-X-VERSION:6',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:2',
        ...segment(2),
        ...segment(3),
        '',
      ],
      removedDurations: [4.004, 3.2],
      removedDiscontinuities: 0,
    });
  });

  it('counts body discontinuities before the first kept segment', () => {
    const lines = [
      ...header,
      ...segment(0),
      '#EXT-X-DISCONTINUITY',
      ...segment(1),
      '#EXT-X-DISCONTINUITY',
      ...segment(2),
      '#EXT-X-DISCONTINUITY',
      ...segment(3),
    ];

    const result = compactHlsPlaylist(lines, 2);

    expect(result?.removedDiscontinuities).toBe(2);
    expect(result?.lines.slice(4)).toEqual([
      ...segment(2),
      '#EXT-X-DISCONTINUITY',
      ...segment(3),
    ]);
  });

  it('strips header discontinuity tags that ffmpeg would read as a discontinuity', () => {
    const lines = [
      ...header,
      '#EXT-X-DISCONTINUITY-SEQUENCE:3',
      '#EXT-X-DISCONTINUITY',
      '#EXT-X-INDEPENDENT-SEGMENTS',
      ...segment(0),
      ...segment(1),
    ];

    const result = compactHlsPlaylist(lines, 1);

    // The mutator skips header tags, so they are not counted either.
    expect(result?.removedDiscontinuities).toBe(0);
    expect(result?.lines).toEqual([
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:4',
      '#EXT-X-MEDIA-SEQUENCE:1',
      '#EXT-X-INDEPENDENT-SEGMENTS',
      ...segment(1),
    ]);
  });

  it('returns undefined when no segment is below the cutoff', () => {
    expect(
      compactHlsPlaylist([...header, ...segment(5), ...segment(6)], 5),
    ).toBeUndefined();
  });

  it('returns undefined instead of emptying the playlist', () => {
    expect(
      compactHlsPlaylist([...header, ...segment(0), ...segment(1)], 10),
    ).toBeUndefined();
  });
});
