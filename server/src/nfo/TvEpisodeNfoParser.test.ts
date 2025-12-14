import { readTestFile } from '../testing/util.ts';
import { TvEpisodeNfoParser } from './TvEpisodeNfoParser.ts';

describe('TvEpisodeNfoParser', () => {
  test('parses basic tv episode file', async () => {
    const contents = (await readTestFile('episode.nfo')).toString('utf-8');
    const result = await new TvEpisodeNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get();

    expect(output.episodedetails[0].credits).length(3);
    expect(output.episodedetails[0].director).length(2);

    console.log(output.episodedetails);
  });

  test('parses basic tv episode file 2', async () => {
    const contents = (await readTestFile('episode2.nfo')).toString('utf-8');
    const result = await new TvEpisodeNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get();

    console.log(output.episodedetails);
  });

  test('parses multi tv episode file', async () => {
    const contents = (await readTestFile('multi-episode.nfo')).toString(
      'utf-8',
    );
    const result = await new TvEpisodeNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get();

    console.log(output.episodedetails);
  });

  test('parses tv episode file with no thumbs', async () => {
    const contents = (await readTestFile('episode_no_thumbs.nfo')).toString(
      'utf-8',
    );
    const result = await new TvEpisodeNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get();

    console.log(output.episodedetails);
  });
});
