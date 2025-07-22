import { readTestFile } from '../testing/util.ts';
import { MovieNfoParser } from './MovieNfoParser.ts';

describe('MovieNfoParser', () => {
  test('parses basic movie file', async () => {
    const contents = (await readTestFile('movie.nfo')).toString('utf-8');
    const output = await new MovieNfoParser().parse(contents);
    console.log(output);
  });
});
