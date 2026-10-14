import { FileStreamSource } from '@/stream/types.js';
import { SubtitlesInputSource } from '../input/SubtitlesInputSource.js';
import { ExternalSubtitleStream, SubtitleMethods } from '../MediaStream.js';
import { SubtitleFilter } from './SubtitleFilter.js';

function makeFilter(path: string) {
  const source = new SubtitlesInputSource(
    new FileStreamSource(path),
    [new ExternalSubtitleStream('subrip', SubtitleMethods.Burn)],
    SubtitleMethods.Burn,
  );
  return new SubtitleFilter(source).filter;
}

describe('SubtitleFilter', () => {
  test.each([
    [
      'apostrophes',
      "/media/Maggie's Plan/Maggie's_Plan.he.srt",
      String.raw`subtitles=/media/Maggie\\\'s Plan/Maggie\\\'s_Plan.he.srt`,
    ],
    [
      'commas',
      '/media/Juliet, Naked/Juliet,_Naked.he.srt',
      String.raw`subtitles=/media/Juliet\, Naked/Juliet\,_Naked.he.srt`,
    ],
    [
      'filter option and graph delimiters',
      '/media/Title: Part; Cut = Final [2026]\\Movie.he.srt',
      String.raw`subtitles=/media/Title\\: Part\; Cut \\= Final \[2026\]\\\\Movie.he.srt`,
    ],
    [
      'Windows paths',
      "C:\\Movies\\Title's.srt",
      String.raw`subtitles=C\\:\\\\Movies\\\\Title\\\'s.srt`,
    ],
    [
      'URLs',
      'http://example.test:8096/Title, Name.srt',
      String.raw`subtitles=http\\://example.test\\:8096/Title\, Name.srt`,
    ],
  ])('escapes %s', (_label, path, expected) => {
    expect(makeFilter(path)).toBe(expected);
  });

  test('leaves ordinary and Unicode filename characters unchanged', () => {
    const path = '/media/Ocean’s Eleven/æon Flux 8½ WALL·E.he.srt';
    expect(makeFilter(path)).toBe(`subtitles=${path}`);
  });
});
