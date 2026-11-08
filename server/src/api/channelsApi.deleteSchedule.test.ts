/**
 * Route test for `DELETE /channels/:id/schedule` (#937).
 */
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/util/logging/LoggerFactory.js', () => {
  const stubLogger: Record<string, unknown> = {};
  stubLogger.error = () => {};
  stubLogger.warn = () => {};
  stubLogger.info = () => {};
  stubLogger.debug = () => {};
  stubLogger.trace = () => {};
  stubLogger.fatal = () => {};
  stubLogger.child = () => stubLogger;
  return {
    LoggerFactory: {
      child: () => stubLogger,
      root: stubLogger,
      get: () => stubLogger,
    },
    Logger: stubLogger,
  };
});

vi.mock('../container.ts', () => ({
  container: { get: () => ({}) },
}));

import { channelsApi } from './channelsApi.js';

const channelId = '11111111-1111-4111-8111-111111111111';

describe('DELETE /channels/:id/schedule (#937)', () => {
  let app: ReturnType<typeof Fastify>;
  let exists: boolean;
  const saveLineup = vi.fn();

  beforeEach(async () => {
    exists = true;
    saveLineup.mockReset();

    app = Fastify()
      .setValidatorCompiler(validatorCompiler)
      .setSerializerCompiler(serializerCompiler)
      .withTypeProvider<ZodTypeProvider>();
    app.decorateRequest('serverCtx', null);
    app.addHook('onRequest', (req, _res, done) => {
      (req as unknown as { serverCtx: unknown }).serverCtx = {
        channelDB: {
          channelExists: async () => exists,
          saveLineup,
        },
      };
      done();
    });
    await app.register(channelsApi);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('clears the schedule and seed without touching the lineup items', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/channels/${channelId}/schedule`,
    });

    expect(res.statusCode).toBe(204);
    expect(saveLineup).toHaveBeenCalledExactlyOnceWith(channelId, {
      schedule: null,
      scheduleSeed: null,
    });
  });

  it('returns 404 for an unknown channel', async () => {
    exists = false;

    const res = await app.inject({
      method: 'DELETE',
      url: `/channels/${channelId}/schedule`,
    });

    expect(res.statusCode).toBe(404);
    expect(saveLineup).not.toHaveBeenCalled();
  });
});
