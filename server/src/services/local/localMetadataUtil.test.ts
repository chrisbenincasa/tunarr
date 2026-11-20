import { TvShowNfoParser } from '../../nfo/TvShowNfoParser.ts';
import { readTestFile } from '../../testing/util.ts';
import {
  extractSeasonAndEpisodeNumber,
  extractSeasonNumberFromFolder,
  groupEpisodeFilesBySeason,
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

  test.each([
    ['s2016.e100761 - De oplosboes - Boes.mp4', 2016, [100761]],
    ['s2025.e08499 - [자막뉴스] title.mp4', 2025, [8499]],
    ['Show.S01.E05.720p.mkv', 1, [5]],
    ['Show_S03_E07.mkv', 3, [7]],
    ['Show.S01E01-E02.mkv', 1, [1, 2]],
    ['Show.S01E01-02.mkv', 1, [1, 2]],
    ['Show - E3 Expo 2019 - S05E02.mkv', 5, [2]],
  ])('parse %s', (fileName, season, episodes) => {
    expect(extractSeasonAndEpisodeNumber(fileName)).toEqual({
      season,
      episodes,
    });
  });

  test('parse an episode with no season', () => {
    const result = extractSeasonAndEpisodeNumber(
      '다큐 인사이트.E259.251211.720p-NEXT.mkv',
    );
    expect(result).toEqual({ season: null, episodes: [259] });
  });

  test('ignore a codec tag after a season', () => {
    expect(
      extractSeasonAndEpisodeNumber('Title.S01.x264.1080p.mkv'),
    ).toBeUndefined();
  });
});

describe('groupEpisodeFilesBySeason', () => {
  test('group by the season in each filename and skip files without one', () => {
    const files = [
      { name: 'Show - S01E01.mkv' },
      { name: 'Show - S02E01.mkv' },
      { name: 'Show - S01E02E03.mkv' },
      { name: 'Show.E04.mkv' },
      { name: 'Show - Behind the Scenes.mkv' },
    ];

    const grouped = groupEpisodeFilesBySeason(files);

    expect([...grouped.keys()]).toEqual([1, 2]);
    expect(grouped.get(1)).toEqual([
      [files[0], { season: 1, episodes: [1] }],
      [files[2], { season: 1, episodes: [2, 3] }],
    ]);
    expect(grouped.get(2)).toEqual([[files[1], { season: 2, episodes: [1] }]]);
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
