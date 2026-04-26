import { type FindChild, type MediaSourceSettings } from '@tunarr/types';
import { filter } from 'lodash-es';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '..';
import { KnownMedia } from './KnownMedia';
import type { LocalMediaSourceView } from './store';
import {
  type CustomShowView,
  type MediaSourceView,
  type SelectedMedia,
} from './store';

export function useCurrentMediaSource(): MediaSourceSettings | undefined {
  return useStore((s) => s.currentMediaSource);
}

type SourceTypeToLibrary = [
  ['custom-show', CustomShowView],
  ['local', LocalMediaSourceView],
];

export function useCurrentMediaSourceView<
  TypeFilter extends MediaSourceView['type'] | undefined = undefined,
  Out = TypeFilter extends undefined
    ? MediaSourceView
    : FindChild<TypeFilter, SourceTypeToLibrary>,
>(type?: TypeFilter): Out | undefined {
  const library = useStore((s) => s.currentMediaSourceView);
  if (!library) {
    return;
  }

  if (library && type) {
    return library.type === type ? (library as Out) : undefined;
  }

  return library as Out;
}

export function useCurrentMediaSourceAndView<
  TypeFilter extends MediaSourceView['type'] | undefined = undefined,
  OutSourceType = TypeFilter extends undefined
    ? MediaSourceSettings
    : Extract<MediaSourceSettings, { type: TypeFilter }>,
  OutLibraryType = TypeFilter extends undefined
    ? MediaSourceView
    : FindChild<TypeFilter, SourceTypeToLibrary>,
>(type?: TypeFilter): [OutSourceType | undefined, OutLibraryType | undefined] {
  const mediaSource = useCurrentMediaSource();
  const library = useCurrentMediaSourceView(type);
  return [mediaSource as OutSourceType, library as OutLibraryType];
}

export function useKnownMedia() {
  const rawKnownMedia = useStore(useShallow((s) => s.knownMediaByServer));
  const rawHierarchy = useStore(useShallow((s) => s.contentHierarchyByServer));
  return useMemo(
    () => new KnownMedia(rawKnownMedia, rawHierarchy),
    [rawHierarchy, rawKnownMedia],
  );
}

export function useSelectedMedia<
  TypeFilter extends SelectedMedia['type'] | undefined = undefined,
  OutType = TypeFilter extends undefined
    ? SelectedMedia
    : Extract<SelectedMedia, { type: TypeFilter }>,
>(type?: TypeFilter): OutType[] | undefined {
  return useStore((s) => {
    const media = s.selectedMedia;
    if (type) {
      return filter(media, { type }) as OutType[];
    }
    return media as OutType[];
  });
}
