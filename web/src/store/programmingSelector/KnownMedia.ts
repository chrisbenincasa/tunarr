import { MediaSourceId } from '@tunarr/types/schemas';
import { ContentHierarchyMap, KnownMediaMap, MediaItems } from './store';
import { chain } from 'lodash-es';

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

  getChildren(sourceId: MediaSourceId, parentId: string) {
    const hierarchyForSource = this.contentHierarchy[sourceId];
    if (hierarchyForSource) {
      return chain(hierarchyForSource[parentId] ?? [])
        .map((id) => this.getMedia(sourceId, id))
        .compact()
        .value();
    }
    return [];
  }
}
