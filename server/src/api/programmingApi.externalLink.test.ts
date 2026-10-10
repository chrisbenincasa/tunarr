/**
 * Route test for `GET /programs/:id/external-link` with Emby sources (#2247).
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

import { programmingApi } from './programmingApi.js';

const programId = '11111111-1111-4111-8111-111111111111';
const sourceUuid = '22222222-2222-4222-8222-222222222222';

const embyExternalId = {
  sourceType: 'emby',
  externalKey: '12345',
  mediaSourceId: sourceUuid,
  externalSourceId: null,
};

const embySource = {
  uuid: sourceUuid,
  name: 'Emby',
  type: 'emby',
  uri: 'http://emby.local:8096',
};

type SystemInfoResult =
  | { isFailure: () => false; get: () => { Id?: string } }
  | { isFailure: () => true; error: Error };

describe('GET /programs/:id/external-link for Emby (#2247)', () => {
  let app: ReturnType<typeof Fastify>;
  let program: unknown;
  let grouping: unknown;
  let systemInfo: SystemInfoResult;

  beforeEach(async () => {
    program = undefined;
    grouping = undefined;
    systemInfo = { isFailure: () => false, get: () => ({ Id: 'srv-abc' }) };

    app = Fastify()
      .setValidatorCompiler(validatorCompiler)
      .setSerializerCompiler(serializerCompiler)
      .withTypeProvider<ZodTypeProvider>();
    app.decorateRequest('serverCtx', null);
    app.addHook('onRequest', (req, _res, done) => {
      (req as unknown as { serverCtx: unknown }).serverCtx = {
        programDB: {
          getProgramById: async () => program,
          getProgramGrouping: async () => grouping,
        },
        mediaSourceDB: { getAll: async () => [embySource] },
        mediaSourceApiFactory: {
          getEmbyApiClientForMediaSource: async () => ({
            getSystemInfo: async () => systemInfo,
          }),
        },
      };
      done();
    });
    await app.register(programmingApi);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function getLink() {
    return app.inject({
      method: 'GET',
      url: `/programs/${programId}/external-link?forward=false`,
    });
  }

  it('builds an Emby Web item URL with the server ID for a program', async () => {
    program = { externalIds: [embyExternalId] };

    const res = await getLink();

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toBe(
      'http://emby.local:8096/web/index.html#!/item?id=12345&serverId=srv-abc',
    );
  });

  it('builds the URL for a program grouping', async () => {
    grouping = { externalIds: [embyExternalId] };

    const res = await getLink();

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toBe(
      'http://emby.local:8096/web/index.html#!/item?id=12345&serverId=srv-abc',
    );
  });

  it('omits the server ID when the Emby server cannot be reached', async () => {
    program = { externalIds: [embyExternalId] };
    systemInfo = { isFailure: () => true, error: new Error('offline') };

    const res = await getLink();

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toBe(
      'http://emby.local:8096/web/index.html#!/item?id=12345',
    );
  });

  it('redirects to the Emby URL by default', async () => {
    program = { externalIds: [embyExternalId] };

    const res = await app.inject({
      method: 'GET',
      url: `/programs/${programId}/external-link`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      'http://emby.local:8096/web/index.html#!/item?id=12345&serverId=srv-abc',
    );
  });
});
