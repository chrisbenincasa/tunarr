import { readTestFile } from '../testing/util.ts';
import { TvEpisodeNfoParser } from './TvEpisodeNfoParser.ts';

describe('TvEpisodeNfoParser', () => {
  test('parses basic tv episode file', async () => {
    const contents = (await readTestFile('episode.nfo')).toString('utf-8');
    const output = await new TvEpisodeNfoParser().parse(contents);
    console.log(output.get().episodedetails);
  });

  test('parses multi tv episode file', async () => {
    const contents = (await readTestFile('multi-episode.nfo')).toString(
      'utf-8',
    );
    const output = await new TvEpisodeNfoParser().parse(contents);
    console.log(output.get().episodedetails);
  });
});
