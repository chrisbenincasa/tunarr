import { readTestFile } from '../testing/util.ts';
import { TvShowNfoParser } from './TvShowNfoParser.ts';

describe('TvShowNfoParser', () => {
  test('parses basic tv show file', async () => {
    const contents = (await readTestFile('tvshow.nfo')).toString('utf-8');
    const output = await new TvShowNfoParser().parse(contents);
    console.log(output);
  });
});
