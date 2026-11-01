/**
 * Route-level test for HLS connection registration.
 *
 * On HLS sessions the connection token registered by both the master-playlist
 * handshake and the fragment route is the client IP, never a UUID. Session
 * bookkeeping keyed by token and by IP therefore refers to the same thing.
 */
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { HlsSession } from '@/stream/hls/HlsSession.js';
import type { ProgramStreamFactory } from '@/stream/ProgramStreamFactory.ts';
import type { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import { Result } from '@/types/result.js';
import type { HlsOptions } from '../../ffmpeg/builder/constants.ts';
import type { BaseHlsSessionOptions } from '@/stream/hls/BaseHlsSession.ts';
import { BaseHlsSession } from '@/stream/hls/BaseHlsSession.ts';
import Fastify from 'fastify';
import { range } from 'lodash-es';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import type { DeepRequired } from 'ts-essentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../container.js', () => ({ container: { get: vi.fn() } }));
vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: {
    child: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));
vi.mock('@/stream/VideoStream.js', () => ({ VideoStream: class {} }));

import { streamApi } from './streamApi.js';

const MASTER_PLAYLIST = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nstream.m3u8\n';
const VARIANT_PLAYLIST = '#EXTM3U\n#EXTINF:4.0,\n/test/data000000.ts\n';

class TestHlsSession extends BaseHlsSession {
  public readonly sessionType = 'hls' as const;

  async getMasterPlaylist() {
    return Result.success<string | undefined>(MASTER_PLAYLIST);
  }

  async trimPlaylist() {
    return Result.success({ playlist: VARIANT_PLAYLIST });
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

async function buildApp(sessionManager: unknown) {
  const app: ReturnType<typeof Fastify> = Fastify()
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
      featureFlagService: { get: () => false },
    };
    done();
  });
  await app.register(streamApi);
  await app.ready();
  return app;
}

describe('streamApi HLS connection registration', () => {
  let session: TestHlsSession;
  let app: ReturnType<typeof Fastify>;
  let sessionManager: {
    getOrCreateHlsSession: ReturnType<typeof vi.fn>;
    getHlsSession: ReturnType<typeof vi.fn>;
    getHlsSlowerSession: ReturnType<typeof vi.fn>;
  };

  let dir: tmp.DirResult;

  // The fragment route only records segments that exist on disk.
  async function writeSegments(...names: string[]) {
    await fs.mkdir(session.workingDirectory, { recursive: true });
    for (const name of names) {
      await fs.writeFile(path.join(session.workingDirectory, name), '');
    }
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    dir = tmp.dirSync({ unsafeCleanup: true });
    session = new TestHlsSession(makeChannel(), {
      ...baseOptions,
      transcodeDirectory: dir.name,
    });
    sessionManager = {
      getOrCreateHlsSession: vi.fn(async (_id: string, token: string) => {
        // Mirror SessionManager.getOrCreateSession: addConnection(token, ...)
        session.addConnection(token, { ip: token });
        return Result.success(session);
      }),
      getHlsSession: vi.fn(() => session),
      getHlsSlowerSession: vi.fn(() => undefined),
    };

    app = await buildApp(sessionManager);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    dir.removeCallback();
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
    await writeSegments('data000010.ts', 'data000100.ts');

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

  it('a request for a deleted segment returns 404', async () => {
    await writeSegments('data000100.ts');

    await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/hls/data000100.ts`,
      remoteAddress: '203.0.113.10',
    });
    // The client rewinds to a segment that pruning already removed
    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/hls/data000035.ts`,
      remoteAddress: '203.0.113.10',
    });

    expect(res.statusCode).toBe(404);
  });
});

// A viewer that stops fetching segments must not hold back the playlist the
// other viewers see. The session tracks no per-client position, so the window
// always ends at the newest segment ffmpeg wrote.
describe('streamApi HLS playlist window with a stalled viewer', () => {
  const STALLED = '203.0.113.10';
  const LIVE = '203.0.113.20';

  let dir: tmp.DirResult;
  let app: ReturnType<typeof Fastify>;

  function request(file: string, remoteAddress: string) {
    return app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/hls/${file}`,
      remoteAddress,
    });
  }

  function listedNumbers(playlist: string) {
    return [...playlist.matchAll(/(?:data|subs)(\d{6})\.(?:ts|vtt)/g)].map(
      (m) => Number(m[1]),
    );
  }

  beforeEach(async () => {
    dir = tmp.dirSync({ unsafeCleanup: true });
    const session = new HlsSession(
      {
        ...makeChannel(),
        transcodeConfig: {},
      } as unknown as ChannelOrmWithTranscodeConfig,
      {
        streamMode: 'hls',
        initialSegmentCount: 2,
        transcodeDirectory: dir.name,
      },
      {} as StreamProgramCalculator,
      {} as ISettingsDB,
      {} as OnDemandChannelService,
      {} as unknown as ProgramStreamFactory,
    );

    // startInternal() sets the playlist start that trimPlaylist() needs. The
    // transcode loop fails on its first call because its dependencies are
    // stubs, so no ffmpeg starts.
    await (
      session as unknown as { startInternal(): Promise<void> }
    ).startInternal();

    // 60 segments of 4s on disk, as ffmpeg leaves them about 4 minutes in.
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:4',
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];
    for (let i = 0; i < 60; i++) {
      const name = `data${String(i).padStart(6, '0')}.ts`;
      lines.push(
        '#EXTINF:4.000000,',
        '#EXT-X-PROGRAM-DATE-TIME:2026-01-01T00:00:00.000+0000',
        name,
      );
      await fs.writeFile(path.join(session.workingDirectory, name), '');
    }
    await fs.writeFile(
      path.join(session.workingDirectory, 'stream.m3u8'),
      lines.join('\n'),
    );

    app = await buildApp({
      getHlsSession: vi.fn(() => session),
      getHlsSlowerSession: vi.fn(() => undefined),
    });

    // The stalled viewer fetched the first segment, then paused. A paused
    // player keeps polling the playlist.
    expect((await request('data000000.ts', STALLED)).statusCode).toBe(200);
    expect((await request('stream.m3u8', STALLED)).statusCode).toBe(200);
  });

  afterEach(async () => {
    await app.close();
    dir.removeCallback();
  });

  it('serves the live edge of the video playlist to other viewers', async () => {
    const res = await request('stream.m3u8', LIVE);

    expect(res.statusCode).toBe(200);
    expect(listedNumbers(res.body)).toEqual(range(40, 60));
  });

  it('serves the live edge of the subtitle playlist to other viewers', async () => {
    const res = await request('subs.m3u8', LIVE);

    expect(res.statusCode).toBe(200);
    expect(listedNumbers(res.body)).toEqual(range(40, 60));
  });
});

describe('streamApi channel playlist variant flag', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    const session = new TestHlsSession(makeChannel(), baseOptions);
    app = await buildApp({
      getOrCreateHlsSession: vi.fn(async () => Result.success(session)),
      getHlsSession: vi.fn(() => session),
      getHlsSlowerSession: vi.fn(() => undefined),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves the master playlist by default', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}.m3u8?mode=hls`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(MASTER_PLAYLIST);
  });

  it('serves the variant playlist when variant=true', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}.m3u8?mode=hls&variant=true`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(VARIANT_PLAYLIST);
  });
});

describe('streamApi etv_next mode gate', () => {
  it('refuses an explicit etv_next mode when neither the flag nor the channel opts in', async () => {
    const getOrCreateEtvNextSession = vi.fn();
    const app = await buildApp({ getOrCreateEtvNextSession });

    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}.m3u8?mode=etv_next`,
    });
    await app.close();

    expect(res.statusCode).toBe(400);
    expect(getOrCreateEtvNextSession).not.toHaveBeenCalled();
  });
});

describe('streamApi etv_next file serving', () => {
  it('answers 404 for a file teardown already removed', async () => {
    const dir = tmp.dirSync({ unsafeCleanup: true });
    const etvSession = {
      stoppingOrStopped: false,
      workingDirectory: dir.name,
      isKnownConnection: () => true,
      recordHeartbeat: vi.fn(),
    };
    const app = await buildApp({ getEtvNextSession: () => etvSession });

    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/etv_next/live.m3u8`,
    });
    await app.close();
    dir.removeCallback();

    expect(res.statusCode).toBe(404);
  });

  it('answers 404 for a stopping session', async () => {
    const app = await buildApp({
      getEtvNextSession: () => ({ stoppingOrStopped: true }),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/stream/channels/${makeChannel().uuid}/etv_next/live.m3u8`,
    });
    await app.close();

    expect(res.statusCode).toBe(404);
  });
});
