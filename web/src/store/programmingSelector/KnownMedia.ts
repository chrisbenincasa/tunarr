import { seq } from '@tunarr/shared/util';
import type { MediaSourceId } from '@tunarr/types/schemas';
import type { ContentHierarchyMap, KnownMediaMap, MediaItems } from './store';

/**
 * Thin wrapper around raw store state. This exposes friendly
 * getters for dealing with locally stored media source metadata
 */
export class KnownMedia {
  constructor(
    private raw: KnownMediaMap,
    private contentHierarchy: ContentHierarchyMap,
  ) {}

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
    OutType = Extract<MediaItems, { type: MediaItemType }>['item'],
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

    return media.item as OutType;
  }

  getPlexMedia(sourceId: MediaSourceId, itemId: string) {
    return this.getMediaOfType(sourceId, itemId, 'plex');
  }

  getJellyfinMedia(sourceId: MediaSourceId, itemId: string) {
    return this.getMediaOfType(sourceId, itemId, 'jellyfin');
  }

  getChildren(sourceId: MediaSourceId, parentId: string) {
    const hierarchyForSource = this.contentHierarchy[sourceId];
    if (hierarchyForSource) {
      return seq.collect(hierarchyForSource[parentId] ?? [], (id) =>
        this.getMedia(sourceId, id),
      );
    }
    return [];
  }
}
