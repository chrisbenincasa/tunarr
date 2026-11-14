import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import { defaultXmlTvSettings } from '../src/db/SettingsDB.ts';
import type { ISettingsDB } from '../src/db/interfaces/ISettingsDB.ts';
import { globalOptions } from '../src/globals.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort());
});

afterAll(async () => {
  await app?.close();
});

describe('GET /api/xmltv.xml', () => {
  test('serves the fallback file while the configured path is not writable', async () => {
    const databaseDirectory = globalOptions().databaseDirectory;
    const settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
    await settingsDB.updateSettings('xmltv', {
      ...settingsDB.xmlTvSettings(),
      outputPath: path.join(databaseDirectory, 'unmounted', 'xmltv.xml'),
    });

    await fs.writeFile(
      defaultXmlTvSettings(databaseDirectory).outputPath,
      '<tv source="{{host}}"/>',
    );

    const res = await app.inject({ method: 'GET', url: '/api/xmltv.xml' });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).toBe('<tv source="http://localhost:80"/>');
  });

  test('returns a 500 when the XMLTV file does not exist yet', async () => {
    const databaseDirectory = globalOptions().databaseDirectory;
    const settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
    await fs.mkdir(path.join(databaseDirectory, 'empty'), { recursive: true });
    await settingsDB.updateSettings('xmltv', {
      ...settingsDB.xmlTvSettings(),
      outputPath: path.join(databaseDirectory, 'empty', 'xmltv.xml'),
    });

    const res = await app.inject({ method: 'GET', url: '/api/xmltv.xml' });

    expect(res.statusCode).toBe(500);
  });

  test('streams a multi-chunk file and replaces {{host}} across a read boundary', async () => {
    const databaseDirectory = globalOptions().databaseDirectory;
    const settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
    const outputPath = path.join(databaseDirectory, 'large', 'xmltv.xml');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await settingsDB.updateSettings('xmltv', {
      ...settingsDB.xmlTvSettings(),
      outputPath,
    });

    // File reads come in 64 KiB chunks, and the first placeholder straddles
    // the first boundary.
    const readChunk = 64 * 1024;
    const content =
      'a'.repeat(readChunk - 3) +
      '{{host}}' +
      'b'.repeat(1024 * 1024) +
      '{{host}}';
    await fs.writeFile(outputPath, content);

    const res = await app.inject({ method: 'GET', url: '/api/xmltv.xml' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-length']).toBeUndefined();
    expect(res.body).toBe(
      content.replaceAll('{{host}}', 'http://localhost:80'),
    );
  });
});
