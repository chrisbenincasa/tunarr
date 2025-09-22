import { seq } from '@tunarr/shared/util';
import type { MediaSourceType } from '@tunarr/types';
import { Jellyfin, Plex } from '../../helpers/constants.ts';
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

  getMediaForSourceId(sourceId: string) {
    const found = this.raw[sourceId];
    if (!found) {
      return {};
    }
    return found;
  }

  getMedia(sourceId: string, itemId: string): MediaItems | undefined {
    return this.getMediaForSourceId(sourceId)[itemId];
  }

  getMediaOfType<MediaItemType extends MediaSourceType>(
    sourceId: string,
    itemId: string,
    type: MediaItemType,
  ): MediaItems | undefined {
    const media = this.getMedia(sourceId, itemId);
    if (!media) {
      return;
    }

    if (media.sourceType !== type) {
      return;
    }

    return media;
  }

  getPlexMedia(sourceId: string, itemId: string) {
    return this.getMediaOfType(sourceId, itemId, Plex);
  }

  getJellyfinMedia(sourceId: string, itemId: string) {
    return this.getMediaOfType(sourceId, itemId, Jellyfin);
  }

  getChildren(sourceId: string, parentId: string) {
    const hierarchyForSource = this.contentHierarchy[sourceId];
    if (hierarchyForSource) {
      return seq.collect(hierarchyForSource[parentId] ?? [], (id) =>
        this.getMedia(sourceId, id),
      );
    }
    return [];
  }
}
