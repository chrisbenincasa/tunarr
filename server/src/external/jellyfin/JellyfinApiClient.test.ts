import { Result } from '@/types/result.js';
import { describe, expect, it, vi } from 'vitest';
import type { MediaStream } from '../../types/Media.ts';
import movieWithExternalSubtitles from './__fixtures__/movie-with-external-subtitles.json' with { type: 'json' };
import { JellyfinApiClient } from './JellyfinApiClient.js';

const { fakeLogger } = vi.hoisted(() => {
  const fakeLogger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: () => fakeLogger,
  };
  return { fakeLogger };
});

vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: { child: () => fakeLogger, root: fakeLogger },
}));

vi.mock('@/util/version.js', () => ({
  getTunarrVersion: () => '1.0.0-test',
}));

const ITEM_ID = '856ca382f09d9481464c88baca4862f0';

function makeMinimalJellyfinClient() {
  const canonicalizer = {
    getCanonicalId: (item: { Id: string }) => `jellyfin://movie/${item.Id}`,
  };

  return new JellyfinApiClient(canonicalizer as never, {
    mediaSource: {
      uuid: 'media-source-1',
      name: 'Test Jellyfin' as never,
      type: 'jellyfin',
      uri: 'http://localhost:8096',
      accessToken: 'test-token',
      libraries: [],
    } as never,
  });
}

async function canonicalizedStreams(): Promise<MediaStream[]> {
  const client = makeMinimalJellyfinClient();
  vi.spyOn(client, 'getRawItem').mockResolvedValue(
    Result.success(movieWithExternalSubtitles as never),
  );

  const result = await client.getMovie(ITEM_ID);
  expect(result.isSuccess()).toBe(true);
  return result.get().mediaItem?.streams ?? [];
}

// Real /Items response for a movie whose two English SRT sidecars are reported
// by Jellyfin as external streams at container indexes 0 and 1, ahead of the
// video (2), audio (3) and five embedded PGS subtitle streams (4-8).
describe('JellyfinApiClient external subtitle canonicalization', () => {
  it('offsets container streams past the leading external streams', async () => {
    const streams = await canonicalizedStreams();

    // Two leading external streams => offset of 2.
    expect(streams.find((s) => s.streamType === 'video')?.index).toBe(0);
    expect(streams.find((s) => s.streamType === 'audio')?.index).toBe(1);
    expect(
      streams.filter((s) => s.streamType === 'subtitles').map((s) => s.index),
    ).toEqual([2, 3, 4, 5, 6]);
  });

  it('records both external subtitles as external_subtitles streams', async () => {
    const streams = await canonicalizedStreams();

    expect(
      streams.filter((s) => s.streamType === 'external_subtitles'),
    ).toHaveLength(2);
  });

  it('gives each external subtitle a delivery route built from its raw index', async () => {
    const streams = await canonicalizedStreams();

    // Jellyfin's /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/Stream.{format}
    // route takes the raw MediaStream.Index (0 and 1), not the offset-adjusted
    // one -- which is exactly why the adjusted index cannot address these.
    expect(
      streams
        .filter((s) => s.streamType === 'external_subtitles')
        .map((s) => s.externalKey),
    ).toEqual([
      `/Videos/${ITEM_ID}/${ITEM_ID}/Subtitles/0/Stream.srt`,
      `/Videos/${ITEM_ID}/${ITEM_ID}/Subtitles/1/Stream.srt`,
    ]);
  });

  it('records where the subtitle files live on the media source', async () => {
    const streams = await canonicalizedStreams();

    // Usable directly only if Tunarr can see the same storage, which is why it
    // is kept separately from the route above.
    expect(
      streams
        .filter((s) => s.streamType === 'external_subtitles')
        .map((s) => s.fileName),
    ).toEqual([
      '/data/media/movies/The 40 Year Old Virgin (2005)/The 40 Year Old Virgin (2005) {imdb-tt0405422} {edition-Extended} [Bluray-1080p][DTS-HD MA 5.1][h264]-REFRACTiON.en.hi.srt',
      '/data/media/movies/The 40 Year Old Virgin (2005)/The 40 Year Old Virgin (2005) {imdb-tt0405422} {edition-Extended} [Bluray-1080p][DTS-HD MA 5.1][h264]-REFRACTiON.en.srt',
    ]);
  });

  it('collapses both external subtitle indexes to 0, so they cannot be told apart by index', async () => {
    const streams = await canonicalizedStreams();

    // Documents why external subtitles are addressed by delivery path: after
    // the offset is applied both land on 0, colliding with each other and with
    // the video stream.
    expect(
      streams
        .filter((s) => s.streamType === 'external_subtitles')
        .map((s) => s.index),
    ).toEqual([0, 0]);
  });

  it('keeps the hearing-impaired flag that tells the two English sidecars apart', async () => {
    const streams = await canonicalizedStreams();

    // Both sidecars are English SRT and neither is flagged default, so `sdh` is
    // the only thing distinguishing them.
    expect(
      streams
        .filter((s) => s.streamType === 'external_subtitles')
        .map((s) => s.sdh),
    ).toEqual([true, false]);
  });

  it('does not set either location on embedded subtitle streams', async () => {
    const streams = await canonicalizedStreams();

    for (const stream of streams.filter((s) => s.streamType === 'subtitles')) {
      expect(stream.fileName).toBeUndefined();
      expect(stream.externalKey).toBeUndefined();
    }
  });
});
