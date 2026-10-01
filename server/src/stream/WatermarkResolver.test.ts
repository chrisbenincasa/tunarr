import { describe, expect, test, vi } from 'vitest';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import { WatermarkResolver } from './WatermarkResolver.ts';

vi.mock('../globals.ts', () => ({ serverOptions: () => ({ port: 8000 }) }));

const watermark: NonNullable<ChannelOrm['watermark']> = {
  enabled: true,
  url: 'https://images.example/logo.png',
  position: 'bottom-right',
  width: 10,
  verticalMargin: 5,
  horizontalMargin: 5,
  duration: 0,
  opacity: 100,
};

const channel: Pick<ChannelOrm, 'watermark' | 'icon' | 'disableFillerOverlay'> =
  {
    watermark,
    icon: {
      path: '/icons/channel.png',
      width: 0,
      duration: 0,
      position: 'top-left',
    },
    disableFillerOverlay: false,
  };

const tunarrLogo = 'http://localhost:8000/images/tunarr.png';

function makeResolver(cached: { path: string } | Error = { path: '/cache/a' }) {
  const cacheImageService = {
    getOrDownloadImageUrl: vi.fn(() =>
      cached instanceof Error
        ? Promise.reject(cached)
        : Promise.resolve(cached),
    ),
  };

  return {
    resolver: new WatermarkResolver(cacheImageService as never),
    cacheImageService,
  };
}

const resolve = (
  resolver: WatermarkResolver,
  overrides: {
    channel?: Partial<typeof channel>;
    disableChannelOverlay?: boolean;
    type?: 'program' | 'commercial';
  } = {},
) =>
  resolver.resolve({
    channel: { ...channel, ...overrides.channel },
    transcodeConfig: {
      disableChannelOverlay: overrides.disableChannelOverlay ?? false,
    },
    lineupItem: { type: overrides.type ?? 'program' },
  });

describe('WatermarkResolver', () => {
  test('serves a remote watermark from the image cache', async () => {
    const { resolver, cacheImageService } = makeResolver();

    const result = await resolve(resolver);

    expect(cacheImageService.getOrDownloadImageUrl).toHaveBeenCalledWith(
      watermark.url,
    );
    expect(result).toMatchObject({ enabled: true, url: '/cache/a', width: 10 });
  });

  test('falls back to the Tunarr logo when the cache cannot fetch the image', async () => {
    const { resolver } = makeResolver(new Error('offline'));

    expect((await resolve(resolver))?.url).toBe(tunarrLogo);
  });

  test('uses a localhost URL as is', async () => {
    const { resolver, cacheImageService } = makeResolver();
    const url = 'http://localhost:8000/images/custom.png';

    const result = await resolve(resolver, {
      channel: { watermark: { ...watermark, url } },
    });

    expect(result?.url).toBe(url);
    expect(cacheImageService.getOrDownloadImageUrl).not.toHaveBeenCalled();
  });

  test('uses the channel icon when the watermark has no URL', async () => {
    const { resolver } = makeResolver();

    const result = await resolve(resolver, {
      channel: { watermark: { ...watermark, url: undefined } },
    });

    expect(result?.url).toBe('/icons/channel.png');
  });

  test('falls back to the Tunarr logo when the channel has no icon either', async () => {
    const { resolver } = makeResolver();

    const result = await resolve(resolver, {
      channel: {
        watermark: { ...watermark, url: undefined },
        icon: { path: '', width: 0, duration: 0, position: 'top-left' },
      },
    });

    expect(result?.url).toBe(tunarrLogo);
  });

  test('plays no watermark when the transcode config disables overlays', async () => {
    const { resolver } = makeResolver();

    expect(
      await resolve(resolver, { disableChannelOverlay: true }),
    ).toBeUndefined();
  });

  test('plays no watermark over filler when the channel disables it there', async () => {
    const { resolver } = makeResolver();
    const fillerOff = { channel: { disableFillerOverlay: true } };

    expect(
      await resolve(resolver, { ...fillerOff, type: 'commercial' }),
    ).toBeUndefined();
    expect(await resolve(resolver, fillerOff)).toBeDefined();
  });

  test('plays no watermark when the channel has none enabled', async () => {
    const { resolver } = makeResolver();

    expect(
      await resolve(resolver, {
        channel: { watermark: { ...watermark, enabled: false } },
      }),
    ).toBeUndefined();
  });
});
