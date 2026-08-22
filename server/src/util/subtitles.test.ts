import { describe, expect, it } from 'vitest';
import type { MediaSourceId } from '../db/schema/base.ts';
import {
  externalSubtitleDeliveryPath,
  getSubtitleCacheFilePath,
} from './subtitles.ts';

const program = {
  id: 'program-1',
  externalSourceType: 'jellyfin' as const,
  externalSourceId: 'source-1' as MediaSourceId,
  externalKey: 'item-1',
};

describe('externalSubtitleDeliveryPath', () => {
  it('prefers the delivery URL reported by the server', () => {
    expect(
      externalSubtitleDeliveryPath('item', 'source', {
        Index: 2,
        Codec: 'subrip',
        DeliveryUrl: '/Videos/item/source/Subtitles/2/abc/Stream.srt',
      }),
    ).toBe('/Videos/item/source/Subtitles/2/abc/Stream.srt');
  });

  it('synthesizes a delivery path from the raw stream index', () => {
    expect(
      externalSubtitleDeliveryPath('item', 'source', {
        Index: 2,
        Codec: 'subrip',
      }),
    ).toBe('/Videos/item/source/Subtitles/2/Stream.srt');
  });

  it('falls back to the item id when the media source has no id', () => {
    expect(
      externalSubtitleDeliveryPath('item', null, { Index: 0, Codec: 'ass' }),
    ).toBe('/Videos/item/item/Subtitles/0/Stream.ass');
  });

  it('returns nothing for codecs the server will not deliver as a file', () => {
    expect(
      externalSubtitleDeliveryPath('item', 'source', {
        Index: 2,
        Codec: 'pgssub',
      }),
    ).toBeUndefined();
  });

  it('returns nothing without a stream index', () => {
    expect(
      externalSubtitleDeliveryPath('item', 'source', { Codec: 'subrip' }),
    ).toBeUndefined();
  });
});

describe('getSubtitleCacheFilePath', () => {
  it('gives external subtitles of the same codec distinct cache files', () => {
    // Neither has a stream index, so without the key they would collide and
    // one language would be served in place of the other.
    const eng = getSubtitleCacheFilePath(program, {
      streamIndex: undefined,
      codec: 'subrip',
      key: '/Videos/item-1/item-1/Subtitles/2/Stream.srt',
    });
    const spa = getSubtitleCacheFilePath(program, {
      streamIndex: undefined,
      codec: 'subrip',
      key: '/Videos/item-1/item-1/Subtitles/3/Stream.srt',
    });

    expect(eng).not.toBeNull();
    expect(eng).not.toBe(spa);
  });

  it('leaves indexed subtitle cache paths unchanged when no key is given', () => {
    const withoutKey = getSubtitleCacheFilePath(program, {
      streamIndex: 2,
      codec: 'subrip',
    });

    expect(withoutKey).toBe(
      getSubtitleCacheFilePath(program, {
        streamIndex: 2,
        codec: 'subrip',
        key: null,
      }),
    );
  });

  it('returns null for codecs with no sidecar representation', () => {
    expect(
      getSubtitleCacheFilePath(program, { streamIndex: 2, codec: 'pgssub' }),
    ).toBeNull();
  });
});
