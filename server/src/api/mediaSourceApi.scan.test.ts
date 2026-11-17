/**
 * Route tests for the media source scan endpoints (#2271).
 *
 * `POST /media-sources/:id/scan` scans every enabled library of a source, the
 * same as `POST /media-sources/:id/libraries/all/scan`.
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

// The real factory pulls in a module cycle unrelated to these routes.
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
const unknownId = 'c0b6a3a4-8f0e-4d43-9a43-3f8f5f0d2a11';

type FakeSource = {
  uuid: string;
  type: 'plex' | 'local';
  libraries: { uuid: string; enabled: boolean }[];
};

function makeContext(source: FakeSource) {
  return {
    mediaSourceDB: {
      getById: vi.fn(async (id: string) =>
        id === source.uuid ? source : undefined,
      ),
    },
    mediaSourceScanCoordinator: {
      add: vi.fn(async () => true),
      addLocal: vi.fn(async () => true),
    },
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

const plexSource: FakeSource = {
  uuid: mediaSourceId,
  type: 'plex',
  libraries: [
    { uuid: 'lib-movies', enabled: true },
    { uuid: 'lib-shows', enabled: true },
    { uuid: 'lib-disabled', enabled: false },
  ],
};

const localSource: FakeSource = {
  uuid: mediaSourceId,
  type: 'local',
  libraries: [{ uuid: 'lib-local', enabled: true }],
};

describe('POST /media-sources/:id/scan', () => {
  test('queues a scan for each enabled library of a remote source', async () => {
    const ctx = makeContext(plexSource);
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'POST',
      url: `/media-sources/${mediaSourceId}/scan`,
    });

    expect(response.statusCode).toBe(202);
    expect(ctx.mediaSourceScanCoordinator.add.mock.calls).toEqual([
      [{ libraryId: 'lib-movies', forceScan: false }],
      [{ libraryId: 'lib-shows', forceScan: false }],
    ]);
    expect(ctx.mediaSourceScanCoordinator.addLocal).not.toHaveBeenCalled();
    await app.close();
  });

  test('queues one forced scan for a local source', async () => {
    const ctx = makeContext(localSource);
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'POST',
      url: `/media-sources/${mediaSourceId}/scan?forceScan=true`,
    });

    expect(response.statusCode).toBe(202);
    expect(
      ctx.mediaSourceScanCoordinator.addLocal,
    ).toHaveBeenCalledExactlyOnceWith({ mediaSourceId, forceScan: true });
    expect(ctx.mediaSourceScanCoordinator.add).not.toHaveBeenCalled();
    await app.close();
  });

  test('answers 501 when the source has no enabled libraries', async () => {
    const ctx = makeContext({
      ...plexSource,
      libraries: [{ uuid: 'lib-disabled', enabled: false }],
    });
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'POST',
      url: `/media-sources/${mediaSourceId}/scan`,
    });

    expect(response.statusCode).toBe(501);
    expect(ctx.mediaSourceScanCoordinator.add).not.toHaveBeenCalled();
    await app.close();
  });

  test('answers 404 for an unknown source', async () => {
    const ctx = makeContext(plexSource);
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'POST',
      url: `/media-sources/${unknownId}/scan`,
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('POST /media-sources/:id/libraries/:libraryId/scan', () => {
  test('libraryId "all" queues the same scans as the source route', async () => {
    const ctx = makeContext(plexSource);
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'POST',
      url: `/media-sources/${mediaSourceId}/libraries/all/scan`,
    });

    expect(response.statusCode).toBe(202);
    expect(ctx.mediaSourceScanCoordinator.add.mock.calls).toEqual([
      [{ libraryId: 'lib-movies', forceScan: false }],
      [{ libraryId: 'lib-shows', forceScan: false }],
    ]);
    await app.close();
  });

  test('a single library id queues only that library', async () => {
    const ctx = makeContext(plexSource);
    const app = await buildApp(ctx);

    const response = await app.inject({
      method: 'POST',
      url: `/media-sources/${mediaSourceId}/libraries/lib-shows/scan`,
    });

    expect(response.statusCode).toBe(202);
    expect(ctx.mediaSourceScanCoordinator.add).toHaveBeenCalledExactlyOnceWith({
      libraryId: 'lib-shows',
      forceScan: false,
    });
    await app.close();
  });
});
