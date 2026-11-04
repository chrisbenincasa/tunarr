import { describe, expect, test } from 'vitest';
import type { OtherVideoNfo } from '../../nfo/NfoSchemas.ts';
import { unwrapOtherVideoNfoContainer } from '../../nfo/NfoSchemas.ts';
import { OtherVideoNfoParser } from '../../nfo/OtherVideoNfoParser.ts';
import { otherVideoNfoToMetadata } from './LocalOtherVideoScanner.ts';

async function parseNfo(input: string): Promise<OtherVideoNfo> {
  const result = await new OtherVideoNfoParser().parse(input);

  if (result.isFailure()) {
    throw new Error('Test NFO failed to parse');
  }

  const nfo = unwrapOtherVideoNfoContainer(result.get());
  if (!nfo) {
    throw new Error('Test NFO did not contain a movie or episode');
  }

  return nfo;
}

describe('otherVideoNfoToMetadata', () => {
  test('maps a movie <plot> to summary', async () => {
    const nfo = await parseNfo(`
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <movie>
        <title>Filler Clip</title>
        <plot>A commercial break from 1994.</plot>
      </movie>
    `);

    const metadata = otherVideoNfoToMetadata(nfo);

    expect(metadata.type).toBe('other_video');
    expect(metadata.summary).toBe('A commercial break from 1994.');
    expect(metadata.plot).toBeNull();
    expect(metadata.tagline).toBeNull();
  });

  test('maps an episodedetails <plot> to summary', async () => {
    const nfo = await parseNfo(`
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <episodedetails>
        <title>Home Video</title>
        <plot>Summer vacation, 1998.</plot>
      </episodedetails>
    `);

    const metadata = otherVideoNfoToMetadata(nfo);

    expect(metadata.summary).toBe('Summer vacation, 1998.');
    expect(metadata.plot).toBeNull();
    expect(metadata.tagline).toBeNull();
  });

  test('leaves summary null when the NFO has no <plot>', async () => {
    const nfo = await parseNfo(`
      <?xml version="1.0" encoding="utf-8" standalone="yes"?>
      <movie>
        <title>Filler Clip</title>
      </movie>
    `);

    const metadata = otherVideoNfoToMetadata(nfo);

    expect(metadata.summary).toBeNull();
    expect(metadata.plot).toBeNull();
    expect(metadata.tagline).toBeNull();
  });
});
