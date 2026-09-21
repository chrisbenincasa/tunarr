import { tag } from '@tunarr/types';
import { anything, instance, mock, when } from 'ts-mockito';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
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
