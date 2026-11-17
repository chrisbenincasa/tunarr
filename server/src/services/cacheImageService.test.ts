import { fileExists } from '@/util/fsUtil.js';
import { isBlockedOutboundUrlError } from '@/util/outboundRequests.js';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { downloadImageToFile } from './cacheImageService.ts';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('downloadImageToFile', () => {
  let server: http.Server;
  let baseUrl: string;
  let dir: string;
  let target: string;
  const requests: string[] = [];

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-cache-image-'));

    server = http.createServer((req, res) => {
      requests.push(req.url ?? '');
      switch (req.url) {
        case '/logo.png':
          res.writeHead(200, { 'content-type': 'image/png' });
          res.end(png);
          return;
        case '/large.png':
          res.writeHead(200, { 'content-type': 'image/png' });
          res.end(Buffer.alloc(64 * 1024));
          return;
        case '/to-metadata':
          res.writeHead(302, {
            location: 'http://169.254.169.254/latest/meta-data/',
          });
          res.end();
          return;
        default:
          res.writeHead(404);
          res.end();
      }
    });

    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server has no TCP address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    requests.length = 0;
    target = path.join(dir, crypto.randomUUID());
  });

  // Loopback and LAN media servers are the normal configuration, so the guard
  // allows them. See checkOutboundUrl.
  test('downloads an image from a loopback address', async () => {
    const mimeType = await downloadImageToFile(`${baseUrl}/logo.png`, target);

    expect(mimeType).toBe('image/png');
    expect(await fs.readFile(target)).toEqual(png);
  });

  test('refuses a cloud metadata address', async () => {
    const error = await downloadImageToFile(
      'http://169.254.169.254/latest/meta-data/',
      target,
    ).catch((e: unknown) => e);

    expect(isBlockedOutboundUrlError(error)).toBe(true);
    expect(await fileExists(target)).toBe(false);
  });

  test('refuses a redirect to a cloud metadata address', async () => {
    const error = await downloadImageToFile(
      `${baseUrl}/to-metadata`,
      target,
    ).catch((e: unknown) => e);

    expect(requests).toEqual(['/to-metadata']);
    expect(isBlockedOutboundUrlError(error)).toBe(true);
    expect(await fileExists(target)).toBe(false);
  });

  test('aborts a body over the size limit and removes the partial file', async () => {
    await expect(
      downloadImageToFile(`${baseUrl}/large.png`, target, 1024),
    ).rejects.toThrow('byte limit');

    expect(await fileExists(target)).toBe(false);
  });
});
