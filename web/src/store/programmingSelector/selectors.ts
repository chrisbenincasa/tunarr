import { FindChild, MediaSourceSettings } from '@tunarr/types';
import useStore from '..';
import {
  CustomShowLibrary,
  PlexLibrary,
  JellyfinLibrary,
  SelectedLibrary,
  SelectedMedia,
} from './store';
import { KnownMedia } from './KnownMedia';
import { filter } from 'lodash-es';

export function useCurrentMediaSource<
  TypeFilter extends MediaSourceSettings['type'] | undefined = undefined,
  OutType = TypeFilter extends undefined
    ? MediaSourceSettings
    : Extract<MediaSourceSettings, { type: TypeFilter }>,
>(type?: TypeFilter): OutType | undefined {
  const source = useStore((s) => s.currentServer);
  if (!source) {
    return;
  }

  if (source && type) {
    return source.type === type ? (source as OutType) : undefined;
  }

  return source as OutType;
}

type SourceTypeToLibrary = [
  ['plex', PlexLibrary],
  ['jellyfin', JellyfinLibrary],
  ['custom-show', CustomShowLibrary],
];

export function useCurrentSourceLibrary<
  TypeFilter extends SelectedLibrary['type'] | undefined = undefined,
  Out = TypeFilter extends undefined
    ? SelectedLibrary
    : FindChild<TypeFilter, SourceTypeToLibrary>,
>(type?: TypeFilter): Out | undefined {
  const library = useStore((s) => s.currentLibrary);
  if (!library) {
    return;
  }

  if (library && type) {
    return library.type === type ? (library as Out) : undefined;
  }

  return library as Out;
}

export function useCurrentMediaSourceAndLibrary<
  TypeFilter extends MediaSourceSettings['type'] | undefined = undefined,
  OutSourceType = TypeFilter extends undefined
    ? MediaSourceSettings
    : Extract<MediaSourceSettings, { type: TypeFilter }>,
  OutLibraryType = TypeFilter extends undefined
    ? SelectedLibrary
    : FindChild<TypeFilter, SourceTypeToLibrary>,
>(type?: TypeFilter): [OutSourceType | undefined, OutLibraryType | undefined] {
  const mediaSource = useCurrentMediaSource(type);
  const library = useCurrentSourceLibrary(type);
  return [mediaSource as OutSourceType, library as OutLibraryType];
}

export function useKnownMedia() {
  return new KnownMedia(useStore((s) => s.knownMediaByServer));
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
