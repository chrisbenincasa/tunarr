import { MediaSourceId } from '@tunarr/types/schemas';
import { KnownMediaMap, MediaItems } from './store';

/**
 * Thin wrapper around raw store state. This exposes friendly
 * getters for dealing with locally stored media source metadata
 */
export class KnownMedia {
  constructor(private raw: KnownMediaMap) {}

  getMediaForSourceId(sourceId: MediaSourceId) {
    const found = this.raw[sourceId];
    if (!found) {
      return {};
    }
    return found;
  }

  getMedia(sourceId: MediaSourceId, itemId: string): MediaItems | undefined {
    return this.getMediaForSourceId(sourceId)[itemId];
  }

  getMediaOfType<
    MediaItemType extends MediaItems['type'],
    OutType = Extract<MediaItems, { type: MediaItemType }>,
  >(
    sourceId: MediaSourceId,
    itemId: string,
    type: MediaItemType,
  ): OutType | undefined {
    const media = this.getMedia(sourceId, itemId);
    if (!media) {
      return;
    }

    if (media.type !== type) {
      return;
    }

    return media as OutType;
  }
}
