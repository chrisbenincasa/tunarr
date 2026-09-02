import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { container } from '../src/container.ts';
import type { ISettingsDB } from '../src/db/interfaces/ISettingsDB.ts';
import { ScheduleJobsStartupTask } from '../src/services/startup/ScheduleJobsStartupTask.ts';
import { KEYS } from '../src/types/inject.ts';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await initTestApp(await getAvailablePort());
  // The settings handlers kick the corresponding scheduled task after saving,
  // and the test server does not run the startup task that registers them.
  await container.get(ScheduleJobsStartupTask).getPromise();
});

afterAll(async () => {
  await app?.close();
});

async function putXmlTv(payload: Record<string, unknown>) {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/xmltv-settings',
    payload,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

async function getXmlTv() {
  const res = await app.inject({ method: 'GET', url: '/api/xmltv-settings' });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

/**
 * The body is `XmlTvSettingsSchema.partial()`, so the declared contract is
 * "update what I send". The handler instead rebuilt a full object from
 * hardcoded defaults, so every omitted field was reset.
 */
describe('PUT /xmltv-settings - partial update', () => {
  test('does not reset the fields it was not sent', async () => {
    // Establish a known non-default state.
    await putXmlTv({
      programmingHours: 36,
      refreshHours: 7,
      enableImageCache: true,
      useShowPoster: true,
    });
    expect(await getXmlTv()).toMatchObject({
      programmingHours: 36,
      refreshHours: 7,
      enableImageCache: true,
      useShowPoster: true,
    });

    // Change exactly one field.
    await putXmlTv({ programmingHours: 48 });

    expect(await getXmlTv()).toMatchObject({
      programmingHours: 48,
      // These were not sent, so they must be untouched.
      refreshHours: 7,
      enableImageCache: true,
      useShowPoster: true,
    });
  });

  test('an empty body changes nothing', async () => {
    await putXmlTv({
      programmingHours: 20,
      refreshHours: 5,
      enableImageCache: true,
      useShowPoster: true,
    });

    await putXmlTv({});

    expect(await getXmlTv()).toMatchObject({
      programmingHours: 20,
      refreshHours: 5,
      enableImageCache: true,
      useShowPoster: true,
    });
  });

  test('still clamps a sent refreshHours below 1', async () => {
    await putXmlTv({ refreshHours: 0 });
    expect((await getXmlTv()).refreshHours).toBe(1);
  });
});

/**
 * The system settings routes serialize `searchServerAddress` as
 * `http://localhost:${meilisearchPort}` against a `z.url()` response schema.
 * The test harness never starts Meilisearch, so the port is undefined and both
 * GET and PUT fail response serialization with a 500 — unrelated to what is
 * under test here. The request body is validated and the settings file is
 * written before that point, so these assert the persisted state directly and
 * only require that the request itself was accepted.
 */
async function putSystem(payload: Record<string, unknown>) {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/system/settings',
    payload,
  });
  expect(res.statusCode, res.body).not.toBe(400);
  return res;
}

function storedLogging() {
  return container.get<ISettingsDB>(KEYS.SettingsDB).systemSettings().logging;
}

/**
 * The sibling blocks in this same handler (backup, cache, server) are guarded
 * with isUndefined/ifDefined. The logging block was the odd one out: it forced
 * useEnvVarLevel back to true, recomputed logLevel, and deleted the category
 * levels whenever `logging` was absent from the body.
 */
describe('PUT /system/settings - partial update', () => {
  const seeded = {
    logging: {
      useEnvVarLevel: false,
      logLevel: 'warn',
      categoryLogLevel: { scheduling: 'debug', streaming: 'trace' },
    },
  };

  test('does not reset logging when the body omits it', async () => {
    await putSystem(seeded);
    expect(storedLogging()).toMatchObject({
      useEnvVarLevel: false,
      logLevel: 'warn',
      categoryLogLevel: { scheduling: 'debug', streaming: 'trace' },
    });

    // A request that says nothing about logging must not touch logging.
    await putSystem({});

    expect(storedLogging()).toMatchObject({
      useEnvVarLevel: false,
      logLevel: 'warn',
      categoryLogLevel: { scheduling: 'debug', streaming: 'trace' },
    });
  });

  test('does not drop category levels when logging is sent without them', async () => {
    await putSystem(seeded);

    // Sending logging without categoryLogLevel means "I am not changing the
    // categories", not "delete them".
    await putSystem({ logging: { logLevel: 'error' } });

    const logging = storedLogging();
    expect(logging.logLevel).toBe('error');
    expect(logging.categoryLogLevel).toMatchObject({
      scheduling: 'debug',
      streaming: 'trace',
    });
  });

  /**
   * categoryLogLevel is declared `LogLevelsSchema.nullish()`, so null is the
   * wire signal for "clear this category". That must still work.
   */
  test('an explicit null still clears one category', async () => {
    await putSystem(seeded);

    await putSystem({ logging: { categoryLogLevel: { scheduling: null } } });

    const logging = storedLogging();
    expect(logging.categoryLogLevel?.scheduling).toBeUndefined();
    // The category that was not mentioned survives.
    expect(logging.categoryLogLevel?.streaming).toBe('trace');
  });

  test('still applies the logging fields it is sent', async () => {
    await putSystem({ logging: { useEnvVarLevel: false, logLevel: 'info' } });

    const logging = storedLogging();
    expect(logging.useEnvVarLevel).toBe(false);
    expect(logging.logLevel).toBe('info');
  });
});
