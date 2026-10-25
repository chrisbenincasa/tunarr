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
    expect(result.get().movie?.uniqueid).toHaveLength(1);
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
    expect(result.get().movie?.uniqueid).toHaveLength(2);
  });

  test('parse nfo with movie root + single studio tag', async () => {
    const input = `
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <movie>
        <title>Movie Title</title>
        <studio>Studio 1</studio>
      </movie>
    `;

    const result = await new OtherVideoNfoParser().parse(input);

    expect(result.isSuccess()).toBeTruthy();
    expect(result.get().movie?.studio).toHaveLength(1);
  });

  test('parse nfo with episodedetails root + single studio tag', async () => {
    const input = `
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <episodedetails>
        <title>Movie Title</title>
        <studio>Studio 1</studio>
      </episodedetails>
    `;

    const result = await new OtherVideoNfoParser().parse(input);

    expect(result.isSuccess()).toBeTruthy();
    expect(result.get().episodedetails?.[0]?.studio).toHaveLength(1);
  });

  test('parse nfo with movie root + with two studio tags', async () => {
    const input = `
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <movie>
        <title>Movie Title</title>
        <studio>Studio 1</studio>
        <studio>Studio 2</studio>
      </movie>
    `;

    const result = await new OtherVideoNfoParser().parse(input);

    expect(result.isSuccess()).toBeTruthy();
    expect(result.get().movie?.studio).toHaveLength(2);
  });

  test('parse nfo with episodedetails root + with two studio tags', async () => {
    const input = `
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <episodedetails>
        <title>Movie Title</title>
        <studio>Studio 1</studio>
        <studio>Studio 2</studio>
      </episodedetails>
    `;

    const result = await new OtherVideoNfoParser().parse(input);

    expect(result.isSuccess()).toBeTruthy();
    expect(result.get().episodedetails?.[0]?.studio).toHaveLength(2);
  });
});
