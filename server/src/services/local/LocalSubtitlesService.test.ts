import { LocalSubtitlesService } from './LocalSubtitlesService.ts';

describe('LocalSubtitlesService', () => {
  test('parse basic', () => {
    const subs = LocalSubtitlesService.parseSubtitleFilePath(
      '/a/b/c/The Player (1992) {imdb-tt0105151}.mkv',
      '/a/b/c/The Player (1992) {imdb-tt0105151}.en.hi.srt',
    );
    expect(subs?.language).toEqual('eng');
    expect(subs?.sdh).toBeTruthy();
  });

  test('parse en-us', () => {
    const subs = LocalSubtitlesService.parseSubtitleFilePath(
      "/a/b/c/Blahblah's Mystery Circus.mkv",
      "/a/b/c/Blahblah's Mystery Circus.en-us.cc.srt",
    );

    expect(subs?.language).toEqual('eng');
    expect(subs?.sdh).toBeTruthy();
  });

  test('parse en_US', () => {
    const subs = LocalSubtitlesService.parseSubtitleFilePath(
      "/a/b/c/Blahblah's Mystery Circus.mkv",
      "/a/b/c/Blahblah's Mystery Circus.en_US.cc.srt",
    );

    expect(subs?.language).toEqual('eng');
    expect(subs?.sdh).toBeTruthy();
  });

  test('parse title with dot in name', () => {
    const subs = LocalSubtitlesService.parseSubtitleFilePath(
      '/a/b/c/Mrs. Sureice (1080p).mkv',
      '/a/b/c/Mrs. Sureice (1080p).en-us.cc.srt',
    );

    expect(subs?.language).toEqual('eng');
    expect(subs?.sdh).toBeTruthy();
  });
});
