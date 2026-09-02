import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { ArtworkType } from '@/db/schema/Artwork.js';
import type { MediaSourceId } from '@/db/schema/base.js';
import type { DrizzleDBAccess } from '@/db/schema/index.js';
import type { Maybe } from '@/types/util.js';
import { isHttpUrl } from '@/util/index.js';
import axios, { isAxiosError } from 'axios';
import { eq } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import { inject, injectable } from 'inversify';
import { isEmpty, trimStart } from 'lodash-es';
import type stream from 'node:stream';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { Artwork } from '../db/schema/Artwork.ts';
import { Credit } from '../db/schema/Credit.ts';
import { globalOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import { extractAxiosHeaders } from '../util/axios.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { FeatureFlagService } from './FeatureFlagService.ts';
import { ImageCache } from './ImageCache.ts';

export type ArtworkResult =
  | { kind: 'file'; path: string; artworkType: ArtworkType }
  | { kind: 'url'; url: string; headers?: Record<string, string> }
  | { kind: 'not-found' };

@injectable()
export class ArtworkService {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(ImageCache) private imageCache: ImageCache,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(FeatureFlagService) private featureFlagService: FeatureFlagService,
  ) {}

  async resolveArtwork(
    entityId: string,
    entityType: 'program' | 'credit',
    artworkType: ArtworkType,
    fallbackTypes?: ArtworkType[],
  ): Promise<ArtworkResult> {
    if (entityType === 'credit') {
      return this.resolveCreditArtwork(entityId, artworkType, fallbackTypes);
    }

    return this.resolveProgramArtwork(entityId, artworkType, fallbackTypes);
  }

  async serveArtwork(
    result: ArtworkResult,
    reply: FastifyReply,
  ): Promise<void> {
    switch (result.kind) {
      case 'not-found':
        await reply.status(404).send();
        return;

      case 'file': {
        const relativePath = trimStart(
          result.path.replace(globalOptions().databaseDirectory, ''),
          '/',
        );
        await reply.sendFile(relativePath, { contentType: true });
        return;
      }

      case 'url': {
        // Artwork that needs a media source credential must always be proxied.
        // Redirecting would put the credential in the Location header, where any
        // unauthenticated caller could read it.
        const requiresCredential = !isEmpty(result.headers);
        if (requiresCredential || this.featureFlagService.get('proxyArtwork')) {
          try {
            const proxyRes = await axios.request<stream.Readable>({
              url: result.url,
              headers: result.headers,
              responseType: 'stream',
            });

            await reply
              .status(200)
              .headers(extractAxiosHeaders(proxyRes.headers))
              .send(proxyRes.data);
          } catch (e) {
            if (isAxiosError(e) && e.response?.status === 404) {
              await reply.status(404).send();
              return;
            }
            this.logger.error(
              e,
              'Upstream error proxying artwork from %s',
              result.url,
            );
            await reply.status(502).send();
          }
        } else {
          await reply.redirect(result.url);
        }
        return;
      }
    }
  }

  private async resolveProgramArtwork(
    entityId: string,
    artworkType: ArtworkType,
    fallbackTypes?: ArtworkType[],
  ): Promise<ArtworkResult> {
    let entity: Maybe<{
      artwork?: Artwork[];
      mediaSourceId: MediaSourceId | null;
      type?: string;
      tvShowUuid?: string | null;
      albumUuid?: string | null;
    }> = await this.programDB.getProgramById(entityId);

    if (!entity) {
      entity = await this.programDB.getProgramGrouping(entityId);
      if (!entity) {
        return { kind: 'not-found' };
      }
    }

    let art = this.findArtworkByType(
      entity.artwork,
      artworkType,
      fallbackTypes,
    );

    // Hierarchical fallback: look up parent grouping artwork
    if (!art && entity.artwork !== undefined) {
      art = await this.resolveParentArtwork(entity, artworkType, fallbackTypes);
    }

    if (!art) {
      return { kind: 'not-found' };
    }

    return this.artworkToResult(art, entity.mediaSourceId);
  }

  private async resolveCreditArtwork(
    entityId: string,
    artworkType: ArtworkType,
    fallbackTypes?: ArtworkType[],
  ): Promise<ArtworkResult> {
    const maybeCredit = await this.drizzleDB.query.credit.findFirst({
      where: eq(Credit.uuid, entityId),
      with: {
        artwork: true,
      },
    });

    if (!maybeCredit) {
      return { kind: 'not-found' };
    }

    const art = this.findArtworkByType(
      maybeCredit.artwork,
      artworkType,
      fallbackTypes,
    );

    if (!art) {
      return { kind: 'not-found' };
    }

    // Credits don't have mediaSourceId yet, so no auth token injection
    return this.artworkToResult(art, null);
  }

  private findArtworkByType(
    artworks: Artwork[] | undefined,
    artworkType: ArtworkType,
    fallbackTypes?: ArtworkType[],
  ): Maybe<Artwork> {
    if (artworks === undefined) {
      return undefined;
    }

    const primary = artworks.find((a) => a.artworkType === artworkType);
    if (primary) {
      return primary;
    }

    if (fallbackTypes !== undefined) {
      for (const fallbackType of fallbackTypes) {
        const fallback = artworks.find((a) => a.artworkType === fallbackType);
        if (fallback) {
          return fallback;
        }
      }
    }

    return undefined;
  }

  private async resolveParentArtwork(
    entity: {
      type?: string;
      tvShowUuid?: string | null;
      albumUuid?: string | null;
    },
    artworkType: ArtworkType,
    fallbackTypes?: ArtworkType[],
  ): Promise<Maybe<Artwork>> {
    if (entity.type === 'episode' && entity.tvShowUuid) {
      const show = await this.programDB.getProgramGrouping(entity.tvShowUuid);
      if (show) {
        return this.findArtworkByType(show.artwork, artworkType, fallbackTypes);
      }
    }

    if (entity.type === 'track' && entity.albumUuid) {
      const album = await this.programDB.getProgramGrouping(entity.albumUuid);
      if (album) {
        return this.findArtworkByType(
          album.artwork,
          artworkType,
          fallbackTypes,
        );
      }
    }

    return undefined;
  }

  private async artworkToResult(
    art: Artwork,
    mediaSourceId: MediaSourceId | null,
  ): Promise<ArtworkResult> {
    if (art.cachePath) {
      const path = this.imageCache.getImagePath(art.cachePath, art.artworkType);
      return { kind: 'file', path, artworkType: art.artworkType };
    }

    if (isHttpUrl(art.sourcePath)) {
      if (!mediaSourceId) {
        // For credits or entities without a media source, return the URL
        // directly without auth token injection
        return { kind: 'url', url: art.sourcePath };
      }

      const mediaSource = await this.mediaSourceDB.getById(mediaSourceId);

      if (!mediaSource) {
        return { kind: 'not-found' };
      }

      const url = URL.parse(art.sourcePath);
      if (!url) {
        this.logger.warn(
          'Failed to parse artwork source path as URL: %s',
          art.sourcePath,
        );
        return { kind: 'not-found' };
      }

      // The credential travels as a request header on a server-side fetch, never
      // as a query param on a URL we hand to the client. Putting it in the URL
      // leaks it via the Location header of a redirect (see GHSA-h3r4-r2f2-qf59
      // against ErsatzTV, which had the same shape).
      const headers: Record<string, string> = {};
      switch (mediaSource.type) {
        case 'plex':
          headers['X-Plex-Token'] = mediaSource.accessToken;
          break;
        case 'jellyfin':
        case 'emby':
          headers['X-Emby-Token'] = mediaSource.accessToken;
          break;
        case 'local':
          break;
      }

      return { kind: 'url', url: url.toString(), headers };
    }

    return { kind: 'file', path: art.sourcePath, artworkType: art.artworkType };
  }
}
