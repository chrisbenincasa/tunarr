import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.ts';

// A valid 1x1 PNG, so file-type detects it as image/png.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const BOUNDARY = 'tunarr-upload-test';

function multipartImage(filename: string, content: Buffer) {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        'Content-Type: image/png\r\n\r\n',
    ),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

const UUID_PNG =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

describe('POST /api/upload/image', () => {
  let app: Awaited<ReturnType<typeof initTestApp>>;

  beforeAll(async () => {
    // One boot per process, because fastify-graceful-shutdown registers a
    // global SIGINT handler.
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
      url: '/api/upload/image',
      headers: {
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipartImage(filename, content),
    });
  }

  test('ignores the client filename and its extension', async () => {
    const page = Buffer.concat([
      PNG_1X1,
      Buffer.from('<script>alert(document.domain)</script>'),
    ]);

    const res = await upload('x.html', page);

    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string; fileUrl: string }>();
    expect(body.name).toMatch(UUID_PNG);
    expect(body.fileUrl).toMatch(new RegExp(`/images/uploads/${body.name}$`));

    const served = await app.inject(`/images/uploads/${body.name}`);
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    const asHtml = await app.inject('/images/uploads/x.html');
    expect(asHtml.statusCode).toBe(404);
  });

  test('saves a traversal filename inside the uploads directory', async () => {
    const res = await upload('../../../escape.png', PNG_1X1);

    expect(res.statusCode).toBe(200);
    const { name } = res.json<{ name: string }>();
    expect(name).toMatch(UUID_PNG);

    const served = await app.inject(`/images/uploads/${name}`);
    expect(served.statusCode).toBe(200);
  });

  test('rejects a file that is not an image', async () => {
    const res = await upload('notes.png', Buffer.from('just text'));

    expect(res.statusCode).toBe(400);
  });
});
