import { readTestFile } from '../testing/util.ts';
import { TvShowNfoParser } from './TvShowNfoParser.ts';

describe('TvShowNfoParser', () => {
  test('parses basic tv show file', async () => {
    const contents = (await readTestFile('tvshow.nfo')).toString('utf-8');
    const result = await new TvShowNfoParser().parse(contents);

    expect(result.isSuccess()).toBe(true);

    const output = result.get();
    expect(output.tvshow).toBeDefined();
    expect(output.tvshow.title).toBe('Star Trek: Discovery');
    expect(output.tvshow.originaltitle).toBe('Star Trek: Discovery');
    expect(output.tvshow.season).toBe(4);
    expect(output.tvshow.episode).toBe(55);
    expect(output.tvshow.userrating).toBe(6);
    expect(output.tvshow.plot).toBe(
      'Follow the voyages of Starfleet on their missions to discover new worlds and new life forms, and one Starfleet officer who must learn that to truly understand all things alien, you must first understand yourself.',
    );
    expect(output.tvshow.premiered).toBe('2017-09-24');
    expect(output.tvshow.mpaa).toBe('Australia:M');
    expect(output.tvshow.studio).toBe('CBS All Access');

    expect(output.tvshow.uniqueid).toHaveLength(3);
    expect(output.tvshow.uniqueid).toEqual([
      { '#text': 'tt5171438', '@_type': 'imdb' },
      { '#text': '67198', '@_type': 'tmdb', '@_default': true },
      { '#text': '328711', '@_type': 'tvdb' },
    ]);

    expect(output.tvshow.genre).toEqual(['Science Fiction']);

    expect(output.tvshow.actor).toHaveLength(3);
    expect(output.tvshow.actor?.[0]).toEqual({
      name: 'Sonequa Martin-Green',
      role: 'Michael Burnham',
      order: 0,
      thumb:
        'https://image.tmdb.org/t/p/original/anz0LIPc0KarbDwLOyGt21eolvK.jpg',
    });

    expect(output.tvshow.thumb).toBeDefined();
    expect(output.tvshow.thumb!.length).toBeGreaterThan(0);
  });

  test('parses numeric title as string', async () => {
    const contents = (await readTestFile('tvshow-number-title.nfo')).toString(
      'utf-8',
    );
    const result = await new TvShowNfoParser().parse(contents);

    expect(result.isSuccess()).toBe(true);

    const output = result.get();
    expect(output.tvshow).toBeDefined();
    expect(output.tvshow.title).toBe('1024');
    expect(output.tvshow.season).toBe(2);
  });
});
