import { FindChild, MediaSourceSettings } from '@tunarr/types';
import { filter } from 'lodash-es';
import useStore from '..';
import { KnownMedia } from './KnownMedia';
import {
  CustomShowView,
  JellyfinMediaSourceView,
  MediaSourceView,
  PlexMediaSourceLibraryViewType,
  PlexMediaSourceView,
  SelectedMedia,
} from './store';

export function useCurrentMediaSource<
  TypeFilter extends MediaSourceSettings['type'] | undefined = undefined,
  OutType = TypeFilter extends undefined
    ? MediaSourceSettings
    : Extract<MediaSourceSettings, { type: TypeFilter }>,
>(type?: TypeFilter): OutType | undefined {
  const source = useStore((s) => s.currentMediaSource);
  if (!source) {
    return;
  }

  if (source && type) {
    return source.type === type ? (source as OutType) : undefined;
  }

  return source as OutType;
}

type SourceTypeToLibrary = [
  ['plex', PlexMediaSourceView],
  ['jellyfin', JellyfinMediaSourceView],
  ['custom-show', CustomShowView],
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

// Returns the current Plex media source view, if it if a library view.
export function useCurrentPlexMediaSourceLibraryView() {
  const view = useCurrentMediaSourceView('plex');
  return view?.view.type === 'library' ? view.view : null;
}

export function useCurrentMediaSourceAndView<
  TypeFilter extends MediaSourceSettings['type'] | undefined = undefined,
  OutSourceType = TypeFilter extends undefined
    ? MediaSourceSettings
    : Extract<MediaSourceSettings, { type: TypeFilter }>,
  OutLibraryType = TypeFilter extends undefined
    ? MediaSourceView
    : FindChild<TypeFilter, SourceTypeToLibrary>,
>(type?: TypeFilter): [OutSourceType | undefined, OutLibraryType | undefined] {
  const mediaSource = useCurrentMediaSource(type);
  const library = useCurrentMediaSourceView(type);
  return [mediaSource as OutSourceType, library as OutLibraryType];
}

// Returns the current Plex media source view, if it if a library view.
export function useCurrentPlexMediaSourceAndLibraryView() {
  const [mediaSource, view] = useCurrentMediaSourceAndView('plex');
  return [
    mediaSource,
    view?.view.type === PlexMediaSourceLibraryViewType.Library
      ? view.view
      : null,
  ] as const;
}

export function useKnownMedia() {
  const [rawKnownMedia, rawHierarchy] = useStore((s) => [
    s.knownMediaByServer,
    s.contentHierarchyByServer,
  ]);
  return new KnownMedia(rawKnownMedia, rawHierarchy);
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
