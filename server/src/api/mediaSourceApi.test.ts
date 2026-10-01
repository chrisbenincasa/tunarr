/**
 * Route-level regression test for #2088 / PR #2206.
 *
 * Removing a local path commits the trash writes and then refreshes the search
 * index: the programs AND the groupings of the removed path have to reach it
 * (the Trash page and the search documents both read `state` from the index),
 * and a search outage must not turn an already committed update into a 500.
 */
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, test, vi } from 'vitest';
import { mediaSourceRouter } from './mediaSourceApi.js';

vi.mock('../container.js', () => ({ container: { get: vi.fn() } }));
// The router builds its logger at registration, and importing the real factory
// pulls in a module cycle (RollingDestination extends SimpleTask before it is
// defined) that has nothing to do with what is under test here.
vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: {
    child: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

const mediaSourceId = '5b23e92a-1490-44e7-bbbd-f22ba8169495';

const updateRequest = {
  id: mediaSourceId,
  name: 'Lab Local',
  type: 'local' as const,
  mediaType: 'movies' as const,
  pathReplacements: [],
  paths: ['/media/movies'],
};

function makeContext(
  trashed: { programIds: string[]; groupingIds: string[] },
  updatePrograms: () => Promise<void>,
) {
  return {
    mediaSourceDB: { updateMediaSource: async () => trashed },
    searchService: { updatePrograms: vi.fn(updatePrograms) },
    mediaSourceScanCoordinator: { addLocal: vi.fn(async () => {}) },
    eventService: { push: vi.fn() },
  };
}

async function buildApp(serverCtx: unknown) {
  const app = Fastify()
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>();
  app.decorateRequest('serverCtx', null);
  app.addHook('onRequest', (req, _res, done) => {
    (req as unknown as { serverCtx: unknown }).serverCtx = serverCtx;
    done();
  });
  await app.register(mediaSourceRouter);
  await app.ready();
  return app;
}

describe('PUT /media-sources/:id removing a local path', () => {
  test('sends the trashed programs and groupings to the search index', async () => {
    const ctx = makeContext(
      { programIds: ['program-1', 'program-2'], groupingIds: ['grouping-1'] },
      async () => {},
    );
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'PUT',
      url: `/media-sources/${mediaSourceId}`,
      payload: updateRequest,
    });

    expect(response.statusCode).toBe(200);
    expect(ctx.searchService.updatePrograms).toHaveBeenCalledWith([
      { id: 'program-1', state: 'missing' },
      { id: 'program-2', state: 'missing' },
      { id: 'grouping-1', state: 'missing' },
    ]);
    expect(ctx.mediaSourceScanCoordinator.addLocal).toHaveBeenCalled();
    await app.close();
  });

  test('still answers 200 when the search index is unavailable', async () => {
    const ctx = makeContext(
      { programIds: ['program-1'], groupingIds: [] },
      () => Promise.reject(new Error('Meilisearch is not reachable')),
    );
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'PUT',
      url: `/media-sources/${mediaSourceId}`,
      payload: updateRequest,
    });

    expect(response.statusCode).toBe(200);
    expect(ctx.eventService.push).toHaveBeenCalled();
    expect(ctx.mediaSourceScanCoordinator.addLocal).toHaveBeenCalled();
    await app.close();
  });

  test('leaves the index alone when nothing was trashed', async () => {
    const ctx = makeContext(
      { programIds: [], groupingIds: [] },
      async () => {},
    );
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'PUT',
      url: `/media-sources/${mediaSourceId}`,
      payload: updateRequest,
    });

    expect(response.statusCode).toBe(200);
    expect(ctx.searchService.updatePrograms).not.toHaveBeenCalled();
    await app.close();
  });
});
