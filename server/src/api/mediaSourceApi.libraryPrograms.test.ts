import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// mediaSourceApi pulls the logger at import time. The route under test never
// logs, so a chainable stub keeps the module graph light.
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

// The route resolves MaterializeProgramsCommand from the container. Pass the
// page through unchanged so the converter stub sees the repository rows.
vi.mock('../container.js', () => ({
  container: {
    get: () => ({ execute: async (programs: unknown[]) => programs }),
  },
}));

import { mediaSourceRouter } from './mediaSourceApi.js';

const libraryId = '11111111-1111-4111-8111-111111111111';

describe('GET /media-libraries/:libraryId/programs', () => {
  let app: ReturnType<typeof Fastify>;
  let library: unknown;
  let getMediaSourceLibraryPrograms: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    library = { uuid: libraryId };
    getMediaSourceLibraryPrograms = vi.fn(async () => ({
      total: 7,
      results: [],
    }));

    app = Fastify()
      .setValidatorCompiler(validatorCompiler)
      .setSerializerCompiler(serializerCompiler)
      .withTypeProvider<ZodTypeProvider>();
    app.decorateRequest('serverCtx', null);
    app.addHook('onRequest', (req, _res, done) => {
      (req as unknown as { serverCtx: unknown }).serverCtx = {
        mediaSourceDB: { getLibrary: async () => library },
        programDB: { getMediaSourceLibraryPrograms },
        programConverter: { materializedProgramToContentProgram: () => null },
      };
      done();
    });
    await app.register(mediaSourceRouter);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('defaults to the first page of 100 and answers a PagedResult', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/media-libraries/${libraryId}/programs`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 7, result: [], size: 0, offset: 0 });
    expect(getMediaSourceLibraryPrograms).toHaveBeenCalledWith(libraryId, {
      limit: 100,
      offset: 0,
    });
  });

  it('passes explicit paging through to the repository', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/media-libraries/${libraryId}/programs?limit=1000&offset=25`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().offset).toBe(25);
    expect(getMediaSourceLibraryPrograms).toHaveBeenCalledWith(libraryId, {
      limit: 1000,
      offset: 25,
    });
  });

  it.each(['limit=1001', 'limit=0', 'limit=-1', 'offset=-1'])(
    'answers 400 for %s',
    async (query) => {
      const res = await app.inject({
        method: 'GET',
        url: `/media-libraries/${libraryId}/programs?${query}`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/querystring\/(limit|offset)/);
      expect(getMediaSourceLibraryPrograms).not.toHaveBeenCalled();
    },
  );

  it('answers 404 for an unknown library', async () => {
    library = undefined;

    const res = await app.inject({
      method: 'GET',
      url: `/media-libraries/${libraryId}/programs`,
    });

    expect(res.statusCode).toBe(404);
    expect(getMediaSourceLibraryPrograms).not.toHaveBeenCalled();
  });
});
