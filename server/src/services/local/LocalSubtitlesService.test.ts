import { sortBy } from 'lodash-es';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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

  test('marks a sidecar with no language tag as undetermined', () => {
    const subs = LocalSubtitlesService.parseSubtitleFilePath(
      '/a/b/c/Movie (2023).mkv',
      '/a/b/c/Movie (2023).srt',
    );

    expect(subs?.language).toEqual('und');
    expect(subs?.codec).toEqual('subrip');
  });

  test('rejects a sidecar for a different title that shares the prefix', () => {
    const subs = LocalSubtitlesService.parseSubtitleFilePath(
      '/a/b/c/Movie (2023).mkv',
      '/a/b/c/Movie (2023) Part 2 (2024).en.srt',
    );

    expect(subs).toBeNull();
  });
});

describe('LocalSubtitlesService.findExternalSubtitles', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-sidecars-'));
    for (const name of [
      'Mrs. Sureice (2023).mkv',
      'Mrs. Sureice (2023).en.srt',
      'Mrs. Sureice (2023).es.forced.ass',
      'Mrs. Sureice (2023).nfo',
      'Mrs. Sureice (2023).srt',
      'Mrs. Sureice (2023) Part 2 (2024).en.srt',
      'Another Movie (2023).en.srt',
    ]) {
      await fs.writeFile(path.join(dir, name), '');
    }
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('finds the sidecars that belong to the video, with full paths', async () => {
    const subs = await new LocalSubtitlesService().findExternalSubtitles(
      path.join(dir, 'Mrs. Sureice (2023).mkv'),
    );

    expect(sortBy(subs, (s) => s.language)).toMatchObject([
      {
        language: 'eng',
        codec: 'subrip',
        subtitleType: 'sidecar',
        forced: false,
        path: path.join(dir, 'Mrs. Sureice (2023).en.srt'),
      },
      {
        language: 'spa',
        codec: 'ass',
        subtitleType: 'sidecar',
        forced: true,
        path: path.join(dir, 'Mrs. Sureice (2023).es.forced.ass'),
      },
      {
        language: 'und',
        codec: 'subrip',
        subtitleType: 'sidecar',
        forced: false,
        path: path.join(dir, 'Mrs. Sureice (2023).srt'),
      },
    ]);
  });
});
