/**
 * Route-level regression test for issue #2200 / PR #2205.
 *
 * Pins what #2200 actually reported: `GET /media-libraries/:libraryId` for a
 * LOCAL media source must answer 200 and carry a non-empty `mediaSource.paths`
 * (the DTO projects the source's `libraries`). When `getLibrary()` did not load
 * that relation the converter produced `paths: []`, the response schema's
 * `nonempty()` rule rejected it and Fastify answered an opaque 500
 * (`FST_ERR_RESPONSE_SERIALIZATION`).
 */
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const entityLocker = {
  isLibraryLocked: () => false,
  isMediaSourceLocked: () => false,
};

// mediaSourceApi pulls the logger (and, transitively, the rolling-file logger)
// at import time; the route under test never logs, so a chainable stub keeps the
// module graph light.
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

vi.mock('../container.js', () => ({
  container: { get: () => entityLocker },
}));

import { mediaSourceRouter } from './mediaSourceApi.js';

const libraryUuid = '11111111-1111-4111-8111-111111111111';
const sourceUuid = '22222222-2222-4222-8222-222222222222';

// The shape `getLibrary()` returns once the relation is loaded (the fix); pass
// false for the pre-fix shape, where the source arrived without its libraries.
function localLibrary(withLibraries: boolean) {
  return {
    uuid: libraryUuid,
    name: 'Movies',
    mediaType: 'movies',
    externalKey: '/media/movies',
    type: 'local',
    enabled: true,
    mediaSource: {
      uuid: sourceUuid,
      type: 'local',
      name: 'Local',
      mediaType: 'movies',
      replacePaths: [],
      libraries: withLibraries
        ? [
            {
              uuid: libraryUuid,
              name: 'Movies',
              mediaType: 'movies',
              externalKey: '/media/movies',
              type: 'local',
              enabled: true,
            },
          ]
        : [],
    },
  };
}

describe('GET /media-libraries/:libraryId for a local source (issue #2200)', () => {
  let app: ReturnType<typeof Fastify>;
  let getLibraryResult: unknown;

  beforeEach(async () => {
    app = Fastify()
      .setValidatorCompiler(validatorCompiler)
      .setSerializerCompiler(serializerCompiler)
      .withTypeProvider<ZodTypeProvider>();
    app.decorateRequest('serverCtx', null);
    app.addHook('onRequest', (req, _res, done) => {
      (req as unknown as { serverCtx: unknown }).serverCtx = {
        mediaSourceDB: { getLibrary: async () => getLibraryResult },
      };
      done();
    });
    await app.register(mediaSourceRouter);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 200 and projects mediaSource.paths from the loaded libraries', async () => {
    getLibraryResult = localLibrary(true);

    const res = await app.inject({
      method: 'GET',
      url: `/media-libraries/${libraryUuid}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mediaSource.paths).toEqual(['/media/movies']);
    expect(body.mediaSource.libraries).toHaveLength(1);
  });

  it('answers 500 when the source arrives without its libraries', async () => {
    // The pre-fix shape: the relation was not loaded, the DTO projected an
    // empty `paths`, and the schema's nonempty() rule turned the route into a
    // 500 instead of the library the caller asked for.
    getLibraryResult = localLibrary(false);

    const res = await app.inject({
      method: 'GET',
      url: `/media-libraries/${libraryUuid}`,
    });

    expect(res.statusCode).toBe(500);
  });
});
