import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { ReplaceAllTransform } from './streams.ts';

async function replaceAll(
  chunks: (string | Buffer)[],
  search = '{{host}}',
  replacement = 'http://tunarr:8000',
) {
  const transform = new ReplaceAllTransform(search, replacement);
  const [, result] = await Promise.all([
    pipeline(Readable.from(chunks, { objectMode: false }), transform),
    text(transform),
  ]);
  return result;
}

describe('ReplaceAllTransform', () => {
  test('replaces every occurrence in one chunk', async () => {
    await expect(
      replaceAll(['<a href="{{host}}/x">{{host}}{{host}}</a>']),
    ).resolves.toEqual(
      '<a href="http://tunarr:8000/x">http://tunarr:8000http://tunarr:8000</a>',
    );
  });

  test('replaces a match split at every possible chunk boundary', async () => {
    const input = 'before {{host}} after';
    for (let cut = 1; cut < input.length; cut++) {
      await expect(
        replaceAll([input.slice(0, cut), input.slice(cut)]),
      ).resolves.toEqual('before http://tunarr:8000 after');
    }
  });

  test('replaces a match spread over one-character chunks', async () => {
    await expect(replaceAll([...'x{{host}}y'])).resolves.toEqual(
      'xhttp://tunarr:8000y',
    );
  });

  test('passes through a trailing partial match', async () => {
    await expect(replaceAll(['ends with {{ho'])).resolves.toEqual(
      'ends with {{ho',
    );
  });

  test('passes through text without a match', async () => {
    await expect(replaceAll(['{ {host} }', '{{'])).resolves.toEqual(
      '{ {host} }{{',
    );
  });

  test('decodes a multi-byte character split across buffers', async () => {
    const bytes = Buffer.from('é{{host}}', 'utf8');
    await expect(
      replaceAll([bytes.subarray(0, 1), bytes.subarray(1)]),
    ).resolves.toEqual('éhttp://tunarr:8000');
  });
});
