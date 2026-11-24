import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ServerContext } from '../ServerContext.ts';
import { settingsApi } from './settingsApi.ts';

const scheduleLibraryScanJobs = vi.hoisted(() => vi.fn());

vi.mock('../services/libraryScanSchedule.ts', () => ({
  scheduleLibraryScanJobs,
}));

function makeSettings() {
  let mediaSource: unknown = {
    scanSchedule: { type: 'interval', hours: 6, minute: 30 },
  };
  return {
    globalMediaSourceSettings: vi.fn(() => mediaSource),
    updateSettings: vi.fn((_key: string, value: unknown) => {
      mediaSource = value;
      return Promise.resolve();
    }),
  };
}

async function buildApp(settings: ReturnType<typeof makeSettings>) {
  const app = Fastify()
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>();
  app.decorateRequest('serverCtx', {
    getter: () => ({ settings }) as unknown as ServerContext,
  });
  await app.register(settingsApi);
  await app.ready();
  return app;
}

describe('PUT /settings/media-source', () => {
  beforeEach(() => {
    scheduleLibraryScanJobs.mockReset();
  });

  test('saves the schedule and reschedules scans', async () => {
    const settings = makeSettings();
    const app = await buildApp(settings);
    const scanSchedule = { type: 'days', daysOfWeek: [0], hour: 4, minute: 0 };

    const res = await app.inject({
      method: 'PUT',
      url: '/settings/media-source',
      payload: { scanSchedule },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ scanSchedule });
    expect(settings.updateSettings).toHaveBeenCalledWith('mediaSource', {
      scanSchedule,
    });
    expect(scheduleLibraryScanJobs).toHaveBeenCalledExactlyOnceWith(
      scanSchedule,
    );
  });

  test('rejects an invalid cron expression without saving', async () => {
    const settings = makeSettings();
    const app = await buildApp(settings);

    const res = await app.inject({
      method: 'PUT',
      url: '/settings/media-source',
      payload: { scanSchedule: { type: 'cron', cron: '0 30 */0 * * *' } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      message: '"0 30 */0 * * *" is not a valid cron expression.',
    });
    expect(settings.updateSettings).not.toHaveBeenCalled();
    expect(scheduleLibraryScanJobs).not.toHaveBeenCalled();
  });

  test('rejects an interval that does not divide 24', async () => {
    const settings = makeSettings();
    const app = await buildApp(settings);

    const res = await app.inject({
      method: 'PUT',
      url: '/settings/media-source',
      payload: { scanSchedule: { type: 'interval', hours: 5, minute: 0 } },
    });

    expect(res.statusCode).toBe(400);
    expect(settings.updateSettings).not.toHaveBeenCalled();
  });
});
