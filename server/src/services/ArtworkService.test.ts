import { tag } from '@tunarr/types';
import type { FastifyReply } from 'fastify';
import { anything, instance, mock, when } from 'ts-mockito';
import { v4 } from 'uuid';
import { describe, expect, test, vi } from 'vitest';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { Artwork } from '../db/schema/Artwork.ts';
import type { MediaSourceId } from '../db/schema/base.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { ArtworkService } from './ArtworkService.ts';
import type { FeatureFlagService } from './FeatureFlagService.ts';
import type { ImageCache } from './ImageCache.ts';

function makeService(opts: {
  program: Record<string, unknown> | undefined;
  mediaSource?: { uri: string; type: string; accessToken: string };
}) {
  const programDB = mock<IProgramDB>();
  const mediaSourceDB = mock<MediaSourceDB>();

  when(programDB.getProgramById(anything())).thenResolve(opts.program as never);
  when(programDB.getProgramGrouping(anything())).thenResolve(
    undefined as never,
  );
  when(mediaSourceDB.getById(anything())).thenResolve(
    (opts.mediaSource ?? undefined) as never,
  );

  return new ArtworkService(
    instance(mock<ImageCache>()),
    instance(programDB),
    instance(mock<DrizzleDBAccess>()),
    instance(mediaSourceDB),
    instance(mock<FeatureFlagService>()),
  );
}

const mediaSourceId = tag<MediaSourceId>(v4());

describe('ArtworkService artwork derivation', () => {
  test('derives a plex artwork url when the program has no artwork row', async () => {
    const service = makeService({
      program: {
        artwork: [],
        type: 'movie',
        mediaSourceId,
        externalKey: 'abc123',
        sourceType: 'plex',
      },
      mediaSource: {
        uri: 'http://plex.local:32400',
        type: 'plex',
        accessToken: 'plex-token',
      },
    });

    const result = await service.resolveArtwork(v4(), 'program', 'poster');

    expect(result.kind).toBe('url');
    if (result.kind !== 'url') return;
    expect(result.url).toBe(
      'http://plex.local:32400/library/metadata/abc123/thumb',
    );
    // The token travels as a header, never on the URL itself.
    expect(result.headers).toEqual({ 'X-Plex-Token': 'plex-token' });
    expect(result.url).not.toContain('plex-token');
  });

  test('derives a jellyfin artwork url', async () => {
    const service = makeService({
      program: {
        artwork: [],
        type: 'movie',
        mediaSourceId,
        externalKey: 'item-9',
        sourceType: 'jellyfin',
      },
      mediaSource: {
        uri: 'http://jf.local:8096',
        type: 'jellyfin',
        accessToken: 'jf-token',
      },
    });

    const result = await service.resolveArtwork(v4(), 'program', 'poster');

    expect(result.kind).toBe('url');
    if (result.kind !== 'url') return;
    expect(result.url).toBe('http://jf.local:8096/Items/item-9/Images/Primary');
    expect(result.headers).toEqual({ 'X-Emby-Token': 'jf-token' });
  });

  test('returns not-found when the program has no media source', async () => {
    const service = makeService({
      program: {
        artwork: [],
        type: 'movie',
        mediaSourceId: null,
        externalKey: 'abc123',
        sourceType: 'plex',
      },
    });

    const result = await service.resolveArtwork(v4(), 'program', 'poster');

    expect(result.kind).toBe('not-found');
  });

  test('returns not-found for a local source, which has no remote artwork url', async () => {
    const service = makeService({
      program: {
        artwork: [],
        type: 'movie',
        mediaSourceId,
        externalKey: '/media/movie.mkv',
        sourceType: 'local',
      },
      mediaSource: {
        uri: '',
        type: 'local',
        accessToken: '',
      },
    });

    const result = await service.resolveArtwork(v4(), 'program', 'poster');

    expect(result.kind).toBe('not-found');
  });

  test('returns not-found when the program does not exist', async () => {
    const service = makeService({ program: undefined });

    const result = await service.resolveArtwork(v4(), 'program', 'poster');

    expect(result.kind).toBe('not-found');
  });
});

const ACCESS_TOKEN = 'super-secret-media-server-token';
const SOURCE_PATH = 'http://plex.local:32400/library/metadata/1/thumb/2';

/**
 * A service whose program already has a stored artwork row, so nothing is
 * derived. Covers the path every artwork request takes, derived or not.
 */
function makeStoredArtworkService(
  sourceType: 'plex' | 'jellyfin' | 'emby' | 'local',
) {
  const programDB = {
    getProgramById: vi.fn().mockResolvedValue({
      artwork: [
        {
          artworkType: 'poster',
          sourcePath: SOURCE_PATH,
          cachePath: null,
        } as unknown as Artwork,
      ],
      mediaSourceId: 'media-source-1' as MediaSourceId,
    }),
    getProgramGrouping: vi.fn().mockResolvedValue(undefined),
  } as unknown as IProgramDB;

  const mediaSourceDB = {
    getById: vi.fn().mockResolvedValue({
      type: sourceType,
      accessToken: ACCESS_TOKEN,
    }),
  } as unknown as MediaSourceDB;

  // proxyArtwork off - the default, and the configuration that used to leak
  const featureFlagService = {
    get: vi.fn().mockReturnValue(false),
  } as unknown as FeatureFlagService;

  return new ArtworkService(
    {} as ImageCache,
    programDB,
    {} as DrizzleDBAccess,
    mediaSourceDB,
    featureFlagService,
  );
}

describe('ArtworkService credential handling', () => {
  test.each([
    ['plex', 'X-Plex-Token'],
    ['jellyfin', 'X-Emby-Token'],
    ['emby', 'X-Emby-Token'],
  ] as const)(
    'keeps the %s access token out of the URL and in a request header',
    async (sourceType, headerName) => {
      const result = await makeStoredArtworkService(sourceType).resolveArtwork(
        'program-1',
        'program',
        'poster',
      );

      expect(result.kind).toBe('url');
      if (result.kind !== 'url') return;

      expect(result.url).not.toContain(ACCESS_TOKEN);
      expect(result.headers?.[headerName]).toBe(ACCESS_TOKEN);
    },
  );

  test('does not attach credentials for a local media source', async () => {
    const result = await makeStoredArtworkService('local').resolveArtwork(
      'program-1',
      'program',
      'poster',
    );

    expect(result.kind).toBe('url');
    if (result.kind !== 'url') return;

    expect(result.url).not.toContain(ACCESS_TOKEN);
    expect(result.headers).toEqual({});
  });
});

describe('ArtworkService serveArtwork', () => {
  test('never redirects a credentialed URL, even with proxyArtwork disabled', async () => {
    const redirect = vi.fn();
    const reply = {
      redirect,
      status: vi.fn().mockReturnThis(),
      headers: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    await makeStoredArtworkService('plex').serveArtwork(
      {
        kind: 'url',
        url: SOURCE_PATH,
        headers: { 'X-Plex-Token': ACCESS_TOKEN },
      },
      reply,
    );

    // A redirect would put the token in the Location header, readable by any
    // unauthenticated caller. See GHSA-h3r4-r2f2-qf59 against ErsatzTV.
    expect(redirect).not.toHaveBeenCalled();
  });

  test('still redirects a credential-free URL when proxyArtwork is disabled', async () => {
    const redirect = vi.fn();
    const reply = { redirect } as unknown as FastifyReply;

    await makeStoredArtworkService('local').serveArtwork(
      { kind: 'url', url: SOURCE_PATH, headers: {} },
      reply,
    );

    expect(redirect).toHaveBeenCalledWith(SOURCE_PATH);
  });

  test('never redirects a URL derived from a credentialed source', async () => {
    const redirect = vi.fn();
    const reply = {
      redirect,
      status: vi.fn().mockReturnThis(),
      headers: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    const service = makeService({
      program: {
        artwork: [],
        type: 'movie',
        mediaSourceId,
        externalKey: 'abc123',
        sourceType: 'plex',
      },
      mediaSource: {
        uri: 'http://plex.local:32400',
        type: 'plex',
        accessToken: 'plex-token',
      },
    });

    const result = await service.resolveArtwork(v4(), 'program', 'poster');
    await service.serveArtwork(result, reply);

    // Derived results are credentialed too, so they must not be redirected
    // either.
    expect(redirect).not.toHaveBeenCalled();
  });
});
