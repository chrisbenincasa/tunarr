import { readTestFile } from '../testing/util.ts';
import { OtherVideoNfoParser } from './OtherVideoNfoParser.ts';

describe('OtherVideoNfoParser', () => {
  test('parse nfo with single uniqueid tag', async () => {
    const input = `
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <movie>
        <title>Movie Title</title>
        <uniqueid type="service" default="true">abc123</uniqueid>
      </movie>
    `;

    const result = await new OtherVideoNfoParser().parse(input);

    expect(result.isSuccess()).toBeTruthy();
    expect(result.get().movie.uniqueid).toHaveLength(1);
  });

  test('parse nfo with two uniqueid tags', async () => {
    const input = `
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <movie>
        <title>Movie Title</title>
        <uniqueid type="service" default="true">abc123</uniqueid>
        <uniqueid type="service2">def456</uniqueid>
      </movie>
    `;

    const result = await new OtherVideoNfoParser().parse(input);

    expect(result.isSuccess()).toBeTruthy();
    expect(result.get().movie.uniqueid).toHaveLength(2);
  });
});
