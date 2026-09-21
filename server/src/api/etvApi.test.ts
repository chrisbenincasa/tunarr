import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { describe, expect, test, vi } from 'vitest';
import type { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { ChannelOrmWithTranscodeConfig } from '../db/schema/derivedTypes.ts';
import { EtvNextDynamicTokenRegistry } from '../stream/etv/EtvNextDynamicTokenRegistry.ts';
import {
  EtvNextPlayoutWriter,
  MaxCallbacksPerWindow,
} from '../stream/etv/EtvNextPlayoutWriter.ts';
import type { PlayoutItem } from '../stream/etv/generated/playout.ts';
import { FileStreamSource } from '../stream/types.ts';
import { Result } from '../types/result.ts';
import type { ZodTypeProvider } from '../util/zod.ts';
import { EtvNextApiController } from './etvApi.ts';

const channelUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const channelNumber = 7;
// The route rejects a header instant far from wall clock, so the fixture's
// moment has to be a live one rather than a fixed date.
const nowMs = Date.now();

const makeChannel = (errorScreen?: string) =>
  ({
    uuid: channelUuid,
    number: channelNumber,
    offline: { mode: 'pic', picture: '/media/offline.png' },
    transcodeConfig: {
      resolution: { widthPx: 1920, heightPx: 1080 },
      ...(errorScreen !== undefined ? { errorScreen } : {}),
    },
  }) as unknown as ChannelOrmWithTranscodeConfig;

const programItem = (streamDuration: number): StreamLineupItem =>
  ({
    type: 'program',
    program: { uuid: 'prog-1', mediaSourceId: 'src-1' },
    infiniteLoop: false,
    programBeginMs: nowMs,
    duration: streamDuration,
    streamDuration,
    startOffset: 0,
  }) as unknown as StreamLineupItem;

/**
 * Mounts the route over a real writer, so a schedule failure is answered the
 * way it would be in production rather than by a stand-in.
 */
async function makeApp({
  lineupItem = programItem(600_000),
  scheduleFails = false,
  channelExists = true,
  errorScreen,
}: {
  lineupItem?: StreamLineupItem;
  scheduleFails?: boolean;
  channelExists?: boolean;
  errorScreen?: string;
} = {}) {
  const programCalculator = {
    getCurrentLineupItem: vi.fn(() =>
      Promise.resolve(
        scheduleFails
          ? Result.failure<never>('no lineup')
          : Result.success({ lineupItem }),
      ),
    ),
  };

  const streamDetailsFetcher = {
    getStream: vi.fn(() =>
      Promise.resolve(
        Result.success({
          streamSource: new FileStreamSource('/media/a.mkv'),
          streamDetails: {},
        }),
      ),
    ),
  };

  const mediaSourceDB = {
    getById: vi.fn(() => Promise.resolve({ id: 'src-1' })),
  };
  const onDemandService = {
    getLiveTimestamp: vi.fn((_id: string, t: number) => Promise.resolve(t)),
  };

  const playoutWriter = new EtvNextPlayoutWriter(
    programCalculator as never,
    streamDetailsFetcher as never,
    mediaSourceDB as never,
    onDemandService as never,
  );

  const channel = makeChannel(errorScreen);
  const channelDB = {
    getChannelOrm: vi.fn(() =>
      Promise.resolve(channelExists ? channel : undefined),
    ),
  };

  const etvSession = { stop: vi.fn(() => Promise.resolve()) };
  const sessionManager = { getEtvNextSession: vi.fn(() => etvSession) };

  const tokenRegistry = new EtvNextDynamicTokenRegistry();
  const token = tokenRegistry.issue(channelUuid, channelNumber);

  const controller = new EtvNextApiController(
    tokenRegistry,
    channelDB as never,
    playoutWriter,
  );

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest('serverCtx', null);
  app.addHook('onRequest', (req, _res, done) => {
    (req as unknown as { serverCtx: unknown }).serverCtx = { sessionManager };
    done();
  });
  await app.register(controller.mount);

  return {
    app,
    token,
    tokenRegistry,
    channelDB,
    programCalculator,
    onDemandService,
    sessionManager,
    etvSession,
    playoutWriter,
  };
}

function request(
  app: Awaited<ReturnType<typeof makeApp>>['app'],
  headers: Record<string, string>,
) {
  return app.inject({ method: 'GET', url: '/etv/playout-item', headers });
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('authorization', () => {
  test('answers a session token with the item it asked for', async () => {
    const { app, token } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-channel': `${channelNumber}`,
      'x-etv-now': new Date(nowMs).toISOString(),
    });

    expect(response.statusCode).toBe(200);
    const item = response.json<PlayoutItem>();
    expect(Date.parse(item.start)).toBe(nowMs);
    expect(item.source).toMatchObject({ source_type: 'local' });
  });

  test('refuses a request carrying no token', async () => {
    const { app } = await makeApp();

    expect((await request(app, {})).statusCode).toBe(401);
  });

  test('refuses a token no session holds', async () => {
    const { app } = await makeApp();

    expect((await request(app, bearer('not-a-real-token'))).statusCode).toBe(
      401,
    );
  });

  test('refuses a basic credential', async () => {
    const { app, token } = await makeApp();

    const response = await request(app, {
      authorization: `Basic ${token}`,
    });

    expect(response.statusCode).toBe(401);
  });

  // The token dies with the session, so a worker Tunarr has stopped cannot
  // keep pulling programming.
  test('refuses a token once its session has stopped', async () => {
    const { app, token, tokenRegistry } = await makeApp();
    tokenRegistry.revoke(channelUuid);

    expect((await request(app, bearer(token))).statusCode).toBe(401);
  });
});

describe('the requested channel', () => {
  // The header is the worker's word for which channel it is. The token is
  // Tunarr's, and only the token decides.
  test('comes from the token rather than the header', async () => {
    const { app, token, channelDB } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-channel': '999',
    });

    expect(response.statusCode).toBe(200);
    expect(channelDB.getChannelOrm).toHaveBeenCalledWith(channelUuid);
  });

  test('reports a channel that has been deleted underneath the worker', async () => {
    const { app, token } = await makeApp({ channelExists: false });

    expect((await request(app, bearer(token))).statusCode).toBe(404);
  });
});

describe('the requested instant', () => {
  test('is the transcode position, which runs ahead of wall clock', async () => {
    const { app, token, programCalculator } = await makeApp();
    const aheadMs = Date.now() + 44_000;

    await request(app, {
      ...bearer(token),
      'x-etv-now': new Date(aheadMs).toISOString(),
    });

    expect(programCalculator.getCurrentLineupItem).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: aheadMs }),
    );
  });

  test('falls back to wall clock when the header is unusable', async () => {
    const { app, token, programCalculator } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': 'halfway through tuesday',
    });

    expect(response.statusCode).toBe(200);
    expect(programCalculator.getCurrentLineupItem).toHaveBeenCalled();
  });

  // Date.parse takes far more than RFC3339, and a wrong-but-parseable instant
  // resolves the schedule for the wrong moment instead of falling back.
  test('rejects a header Date.parse would take but RFC3339 would not', async () => {
    const { app, token, programCalculator } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': '5',
    });

    expect(response.statusCode).toBe(200);
    const [call] = programCalculator.getCurrentLineupItem.mock.calls;
    expect(call?.[0].startTime).toBeGreaterThan(Date.now() - 10_000);
  });

  test('rejects an instant too far from wall clock to be a transcode position', async () => {
    const { app, token, programCalculator } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': new Date(Date.now() + 400 * 86_400_000).toISOString(),
    });

    expect(response.statusCode).toBe(200);
    const [call] = programCalculator.getCurrentLineupItem.mock.calls;
    expect(call?.[0].startTime).toBeLessThan(Date.now() + 10_000);
  });

  // An expanded year renders back as a 5-digit-year timestamp, which the
  // playout schema rejects, which would answer the worker with a 500.
  test('answers an expanded-year instant with a playable item', async () => {
    const { app, token } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': '+012026-01-01T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(200);
    const item = response.json<PlayoutItem>();
    expect(item.start).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
    expect(item.source ?? item.tracks).toBeDefined();
  });

  test('answers the largest instant Date.parse takes with a playable item', async () => {
    const { app, token } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': '+275760-09-13T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(200);
    expect(Number.isNaN(Date.parse(response.json<PlayoutItem>().finish))).toBe(
      false,
    );
  });

  test('ignores an unusable window end rather than failing the request', async () => {
    const { app, token } = await makeApp();

    const response = await request(app, {
      ...bearer(token),
      'x-etv-until': '+275760-09-13T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(200);
  });

  test('runs through the on-demand cursor', async () => {
    const { app, token, onDemandService } = await makeApp();

    await request(app, {
      ...bearer(token),
      'x-etv-now': new Date(nowMs).toISOString(),
    });

    expect(onDemandService.getLiveTimestamp).toHaveBeenCalledWith(
      channelUuid,
      nowMs,
    );
  });
});

describe('failure', () => {
  // An error status costs the viewer black video with nothing logged upstream,
  // so the schedule failing still has to come back as something playable.
  test('answers an unresolvable schedule with an error screen, not a 500', async () => {
    const { app, token } = await makeApp({ scheduleFails: true });

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': new Date(nowMs).toISOString(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<PlayoutItem>().tracks?.video?.source).toMatchObject({
      source_type: 'lavfi',
    });
  });

  test('never answers with a dynamic source, which upstream rejects', async () => {
    const { app, token } = await makeApp();

    const response = await request(app, bearer(token));

    expect(JSON.stringify(response.json())).not.toContain('"dynamic"');
  });
});

// A channel whose error screen is 'kill' wants the stream over rather than a
// picture on it, and only the session can end it.
describe("the 'kill' error screen", () => {
  test('answers 503 and stops the session', async () => {
    const { app, token, sessionManager, etvSession } = await makeApp({
      scheduleFails: true,
      errorScreen: 'kill',
    });

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': new Date(nowMs).toISOString(),
    });

    expect(response.statusCode).toBe(503);
    expect(sessionManager.getEtvNextSession).toHaveBeenCalledWith(channelUuid);
    expect(etvSession.stop).toHaveBeenCalled();
  });

  test('still answers 503 when no session is registered', async () => {
    const { app, token, sessionManager } = await makeApp({
      scheduleFails: true,
      errorScreen: 'kill',
    });
    sessionManager.getEtvNextSession.mockReturnValue(
      undefined as unknown as { stop: () => Promise<void> },
    );

    const response = await request(app, bearer(token));

    expect(response.statusCode).toBe(503);
  });

  test('answers 503 rather than 500 when stopping the session fails', async () => {
    const { app, token, etvSession } = await makeApp({
      scheduleFails: true,
      errorScreen: 'kill',
    });
    etvSession.stop.mockReturnValue(Promise.reject(new Error('no')));

    const response = await request(app, bearer(token));

    expect(response.statusCode).toBe(503);
  });
});

describe('callback rate', () => {
  // A schedule that answers every instant with a millisecond of filler cannot
  // be walked forward to anything playable, so the walk gives up and the route
  // still answers with something the worker can play.
  test('answers a schedule of nothing but millisecond items with an error screen', async () => {
    const { app, token } = await makeApp({ lineupItem: programItem(1) });

    const response = await request(app, {
      ...bearer(token),
      'x-etv-now': new Date(nowMs).toISOString(),
    });

    expect(response.statusCode).toBe(200);
    const item = response.json<PlayoutItem>();
    expect(item.tracks?.video?.source).toMatchObject({
      source_type: 'lavfi',
    });
    expect(
      Date.parse(item.finish) - Date.parse(item.start),
    ).toBeGreaterThanOrEqual(1_000);
  });

  test('backs a flooding channel off instead of walking the schedule again', async () => {
    const { app, token, programCalculator } = await makeApp();

    for (let i = 0; i < MaxCallbacksPerWindow + 5; i++) {
      const response = await request(app, bearer(token));
      expect(response.statusCode).toBe(200);
    }

    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(
      MaxCallbacksPerWindow,
    );
  });
});
