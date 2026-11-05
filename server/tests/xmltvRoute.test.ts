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
});
