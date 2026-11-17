import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { serverOptions } from '../src/globals.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.ts';

// A WAV header with no samples, so file-type detects it as audio/wav.
const EMPTY_WAV = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([36, 0, 0, 0]),
  Buffer.from('WAVEfmt '),
  Buffer.from([16, 0, 0, 0, 1, 0, 1, 0]),
  Buffer.from([0x80, 0xbb, 0, 0, 0x00, 0x77, 0x01, 0, 2, 0, 16, 0]),
  Buffer.from('data'),
  Buffer.from([0, 0, 0, 0]),
]);

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const BOUNDARY = 'tunarr-upload-test';

function multipartFile(filename: string, content: Buffer) {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        'Content-Type: audio/wav\r\n\r\n',
    ),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

const UUID_WAV =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.wav$/;

describe('POST /api/upload/audio', () => {
  let app: Awaited<ReturnType<typeof initTestApp>>;

  beforeAll(async () => {
    app = await initTestApp(await getAvailablePort());
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function upload(filename: string, content: Buffer) {
    return app.inject({
      method: 'POST',
      url: '/api/upload/audio',
      headers: {
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipartFile(filename, content),
    });
  }

  test('saves the file under the data directory and returns its path', async () => {
    const res = await upload('../../theme.html', EMPTY_WAV);

    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string; filePath: string }>();
    expect(body.name).toMatch(UUID_WAV);
    expect(body.filePath).toBe(
      path.join(
        serverOptions().databaseDirectory,
        'uploads',
        'audio',
        body.name,
      ),
    );
    expect(await readFile(body.filePath)).toEqual(EMPTY_WAV);
  });

  test('rejects a file that is not audio', async () => {
    const res = await upload('theme.wav', PNG_1X1);

    expect(res.statusCode).toBe(400);
  });
});
