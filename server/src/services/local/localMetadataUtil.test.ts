import { TvShowNfoParser } from '../../nfo/TvShowNfoParser.ts';
import { readTestFile } from '../../testing/util.ts';
import {
  extractSeasonAndEpisodeNumber,
  extractSeasonNumberFromFolder,
  mapNfoUniqueIds,
  tvShowNfoToShowMetadata,
} from './localMetadataUtil.ts';

describe('extractSeasonAndEpisodeNumber', () => {
  test('parse season and episode from full string', () => {
    const result = extractSeasonAndEpisodeNumber(
      'Madeline (1993) - S02E13 - Madelines Holiday with Mr. Grump [WEBRip-1080p][AAC 2.0][x265]-PoF.mkv',
    );

    expect(result).toMatchObject({ season: 2, episodes: [13] });
  });

  test('parse multiepisode', () => {
    const result = extractSeasonAndEpisodeNumber(
      'Madeline (1993) - S02E13E14 - Madelines Holiday with Mr. Grump [WEBRip-1080p][AAC 2.0][x265]-PoF.mkv',
    );

    expect(result).toMatchObject({ season: 2, episodes: [13, 14] });
  });

  test('parse season and episode with space', () => {
    const result = extractSeasonAndEpisodeNumber(
      'ANIMANIACS - S01 E01 - De-Zanitized, The Monkey Song, and Nighty-Night Toon (480p - DVDRip).mp4',
    );
    expect(result).toMatchObject({ season: 1, episodes: [1] });
  });

  test('parse season and episode with "x" separator', () => {
    const result = extractSeasonAndEpisodeNumber(
      'Bonanza - 4x03 - The Artist.avi',
    );
    expect(result).toMatchObject({ season: 4, episodes: [3] });
  });
});

describe('extractSeasonNumberFromFolder', () => {
  test('parse "season 01"', () => {
    const result = extractSeasonNumberFromFolder('season 01');
    expect(result).toEqual(1);
  });

  test('parse "S1992"', () => {
    const result = extractSeasonNumberFromFolder('S1992');
    expect(result).toEqual(1992);
  });

  test('parse "s03"', () => {
    const result = extractSeasonNumberFromFolder('s03');
    expect(result).toEqual(3);
  });

  test('parse "season specials"', () => {
    const result = extractSeasonNumberFromFolder('season specials');
    expect(result).toEqual(0);
  });

  test('parse "sxyz" to null', () => {
    const result = extractSeasonNumberFromFolder('sxyz');
    expect(result).toBeNull();
  });

  test('parse "000091"', () => {
    const result = extractSeasonNumberFromFolder('000091');
    expect(result).toEqual(91);
  });
});

describe('mapNfoUniqueIds', () => {
  test('maps imdb, tmdb, and tvdb ids', () => {
    expect(
      mapNfoUniqueIds([
        { '#text': 'tt5171438', '@_type': 'imdb' },
        { '#text': '67198', '@_type': 'tmdb', '@_default': true },
        { '#text': '328711', '@_type': 'tvdb' },
      ]),
    ).toEqual([
      { id: 'tt5171438', type: 'imdb' },
      { id: '67198', type: 'tmdb' },
      { id: '328711', type: 'tvdb' },
    ]);
  });

  test('normalizes type case and whitespace', () => {
    expect(
      mapNfoUniqueIds([{ '#text': ' 67198 ', '@_type': ' TMDB ' }]),
    ).toEqual([{ id: '67198', type: 'tmdb' }]);
  });

  test('drops unknown types and empty ids', () => {
    expect(
      mapNfoUniqueIds([
        { '#text': '12345', '@_type': 'anidb' },
        { '#text': '  ', '@_type': 'tvdb' },
      ]),
    ).toEqual([]);
  });

  test('returns an empty list when there are no ids', () => {
    expect(mapNfoUniqueIds(undefined)).toEqual([]);
  });
});

describe('tvShowNfoToShowMetadata', () => {
  test('keeps uniqueid tags as show identifiers', async () => {
    const contents = (await readTestFile('tvshow.nfo')).toString('utf-8');
    const parsed = await new TvShowNfoParser().parse(contents);

    const show = tvShowNfoToShowMetadata(parsed.get().tvshow);

    expect(show.identifiers).toEqual([
      { id: 'tt5171438', type: 'imdb' },
      { id: '67198', type: 'tmdb' },
      { id: '328711', type: 'tvdb' },
    ]);
  });
});
