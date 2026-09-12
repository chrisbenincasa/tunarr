/**
 * Route-level test for HLS connection registration.
 *
 * On HLS sessions the connection token registered by both the master-playlist
 * handshake and the fragment route is the client IP, never a UUID. Session
 * bookkeeping keyed by token and by IP therefore refers to the same thing.
 */
import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import { Result } from '@/types/result.js';
import type { HlsOptions } from '../../ffmpeg/builder/constants.ts';
import type { BaseHlsSessionOptions } from '@/stream/hls/BaseHlsSession.ts';
import { BaseHlsSession } from '@/stream/hls/BaseHlsSession.ts';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { DeepRequired } from 'ts-essentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../container.js', () => ({ container: { get: vi.fn() } }));
vi.mock('@/stream/VideoStream.js', () => ({ VideoStream: class {} }));

import { streamApi } from './streamApi.js';

class TestHlsSession extends BaseHlsSession {
  public readonly sessionType = 'hls' as const;

  async getMasterPlaylist() {
    return Result.success<string | undefined>('#EXTM3U\n');
  }

  protected getHlsOptions(): DeepRequired<HlsOptions> {
    return {
      hlsDeleteThreshold: 3,
      streamNameFormat: 'stream.m3u8',
      segmentNameFormat: 'data%06d.ts',
      segmentBaseDirectory: '/tmp/test-sessions',
      streamBasePath: 'test',
      streamBaseUrl: '/test/',
      hlsTime: 4,
      hlsListSize: 0,
      deleteThreshold: null,
      appendSegments: true,
    };
  }

  protected async startInternal(): Promise<void> {}
  protected async stopInternal(): Promise<void> {}
}

function makeChannel(): ChannelOrmWithTranscodeConfig {
  return {
    uuid: 'e8f0f9e4-0000-4c4a-b000-000000000001',
  } as unknown as ChannelOrmWithTranscodeConfig;
}

const baseOptions: BaseHlsSessionOptions = {
  initialSegmentCount: 2,
  transcodeDirectory: '/tmp/test-sessions',
  stalenessMs: 120_000,
};

describe('streamApi HLS connection registration', () => {
  let session: TestHlsSession;
  let app: ReturnType<typeof Fastify>;
  let sessionManager: {
    getOrCreateHlsSession: ReturnType<typeof vi.fn>;
    getHlsSession: ReturnType<typeof vi.fn>;
    getHlsSlowerSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    session = new TestHlsSession(makeChannel(), baseOptions);
    sessionManager = {
      getOrCreateHlsSession: vi.fn(async (_id: string, token: string) => {
        // Mirror SessionManager.getOrCreateSession: addConnection(token, ...)
        session.addConnection(token, { ip: token });
        return Result.success(session);
      }),
      getHlsSession: vi.fn(() => session),
      getHlsSlowerSession: vi.fn(() => undefined),
    };

    app = Fastify()
      .setValidatorCompiler(validatorCompiler)
      .setSerializerCompiler(serializerCompiler)
      .withTypeProvider<ZodTypeProvider>();
    app.decorateRequest('serverCtx', null);
    app.addHook('onRequest', (req, _res, done) => {
      (req as unknown as { serverCtx: unknown }).serverCtx = {
        channelDB: {
          getChannel: async () => ({
            uuid: makeChannel().uuid,
            streamMode: 'hls',
          }),
        },
        sessionManager,
      };
      done();
    });
    await app.register(streamApi);
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('master playlist handshake registers the connection under the client IP', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}.m3u8`,
      remoteAddress: '203.0.113.10',
    });

    expect(res.statusCode).toBe(200);
    const [, token, details] =
      sessionManager.getOrCreateHlsSession.mock.calls[0];
    expect(token).toBe('203.0.113.10'); // NOT a UUID — streamApi passes req.ip
    expect(details.ip).toBe('203.0.113.10');
    expect(Object.keys(session.connections())).toEqual(['203.0.113.10']);
  });

  it('fragment route keys connections by the client IP and stale cleanup drops them', async () => {
    await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/hls/data000100.ts`,
      remoteAddress: '203.0.113.10',
    });
    await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/hls/data000010.ts`,
      remoteAddress: '203.0.113.20',
    });

    // Every connection token equals the client IP it was registered under —
    // a UUID-token connection never appears on an HLS session.
    for (const [token, conn] of Object.entries(session.connections())) {
      expect(token).toBe(conn.ip);
    }

    // B goes quiet past the staleness window; A keeps heartbeating
    vi.setSystemTime(new Date(Date.now() + 121_000));
    session.recordHeartbeat('203.0.113.10');
    session.removeStaleConnections();

    expect(session.connections()).not.toHaveProperty('203.0.113.20');
    expect(session.connections()).toHaveProperty('203.0.113.10');
  });
});
