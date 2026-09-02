import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { MediaSourceId } from '@/db/schema/base.js';
import type { DrizzleDBAccess } from '@/db/schema/index.js';
import type { FastifyReply } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { Artwork } from '../db/schema/Artwork.ts';
import { ArtworkService } from './ArtworkService.ts';
import type { FeatureFlagService } from './FeatureFlagService.ts';
import type { ImageCache } from './ImageCache.ts';

const ACCESS_TOKEN = 'super-secret-media-server-token';
const SOURCE_PATH = 'http://plex.local:32400/library/metadata/1/thumb/2';

function makeArtwork(): Artwork {
  return {
    artworkType: 'poster',
    sourcePath: SOURCE_PATH,
    cachePath: null,
  } as unknown as Artwork;
}

function makeService(sourceType: 'plex' | 'jellyfin' | 'emby' | 'local') {
  const programDB = {
    getProgramById: vi.fn().mockResolvedValue({
      artwork: [makeArtwork()],
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

describe('ArtworkService', () => {
  describe('credential handling', () => {
    it.each([
      ['plex', 'X-Plex-Token'],
      ['jellyfin', 'X-Emby-Token'],
      ['emby', 'X-Emby-Token'],
    ] as const)(
      'keeps the %s access token out of the URL and in a request header',
      async (sourceType, headerName) => {
        const result = await makeService(sourceType).resolveArtwork(
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

    it('does not attach credentials for a local media source', async () => {
      const result = await makeService('local').resolveArtwork(
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

  describe('serveArtwork', () => {
    it('never redirects a credentialed URL, even with proxyArtwork disabled', async () => {
      const redirect = vi.fn();
      const reply = {
        redirect,
        status: vi.fn().mockReturnThis(),
        headers: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      await makeService('plex').serveArtwork(
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

    it('still redirects a credential-free URL when proxyArtwork is disabled', async () => {
      const redirect = vi.fn();
      const reply = { redirect } as unknown as FastifyReply;

      await makeService('local').serveArtwork(
        { kind: 'url', url: SOURCE_PATH, headers: {} },
        reply,
      );

      expect(redirect).toHaveBeenCalledWith(SOURCE_PATH);
    });
  });
});
