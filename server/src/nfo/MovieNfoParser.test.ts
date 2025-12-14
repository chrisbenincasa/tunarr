import { readTestFile } from '../testing/util.ts';
import { MovieNfoParser } from './MovieNfoParser.ts';

describe('MovieNfoParser', () => {
  test('parses basic movie file', async () => {
    const contents = (await readTestFile('movie.nfo')).toString('utf-8');
    const result = await new MovieNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get();

    expect(output.movie).toBeDefined();

    expect(output.movie.credits).length(2);
    expect(output.movie.director).length(1);
    expect(output.movie.actor).length(5);

    console.log(output);
  });
});
