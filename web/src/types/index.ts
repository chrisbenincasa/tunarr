/// <reference types="vite-plugin-svgr/client" />

import type { TerminalProgram } from '@tunarr/types';
import {
  type ChannelProgram,
  type CondensedChannelProgram,
  type CondensedContentProgram,
  type ContentProgram,
  type CustomProgram,
  type FlexProgram,
  type RedirectProgram,
} from '@tunarr/types';
import type { MarkRequired } from 'ts-essentials';
import type { Emby, Imported, Jellyfin, Plex } from './MediaSource';

export type UIIndex = { uiIndex: number; originalIndex: number };

export type MaybeHasStartTimeOffset = { startTimeOffset?: number };

export type UICondensedChannelProgram<
  T extends CondensedChannelProgram = CondensedChannelProgram,
> = T & UIIndex & Required<MaybeHasStartTimeOffset>;

export type UICondensedContentProgram = CondensedContentProgram &
  UIIndex &
  Required<MaybeHasStartTimeOffset>;
export type UICondensedFlexProgram = UICondensedChannelProgram<FlexProgram>;
export type UICondensedCustomProgram = UICondensedChannelProgram<CustomProgram>;
export type UICondensedRedirectProgram =
  UICondensedChannelProgram<RedirectProgram>;

// It sucks that we have to repeat these everywhere...
export const isUICondensedContentProgram = (
  p: UICondensedChannelProgram,
): p is UICondensedContentProgram => p.type === 'content';

export const isUICondensedFlexProgram = (
  p: UICondensedChannelProgram,
): p is UICondensedFlexProgram => p.type === 'flex';

export const isUICondensedCustomProgram = (
  p: UICondensedChannelProgram,
): p is UICondensedCustomProgram => p.type === 'custom';

export const isUICondensedRedirectProgram = (
  p: UICondensedChannelProgram,
): p is UICondensedRedirectProgram => p.type === 'redirect';

export const isUICondensedContentBackedProgram = (
  p: UICondensedChannelProgram,
): p is UICondensedContentProgram | UICondensedCustomProgram =>
  isUICondensedContentProgram(p) || isUICondensedCustomProgram(p);

// A UIChannelProgram is a ChannelProgram with some other UI-specific fields
// The default type is any ChannelProgram (e.g. content, flex, etc) with the
// fields. We generalize here so we can effectively downcast UIChannelProgram
// to more specific program types when doing list operations.
export type UIChannelProgram<T extends ChannelProgram = ChannelProgram> =
  Prettify<T & UIIndex & MaybeHasStartTimeOffset>;

export type UIChannelProgramWithOffset<
  T extends ChannelProgram = ChannelProgram,
> = MarkRequired<UIChannelProgram<T>, 'startTimeOffset'>;

export type UIContentProgram = UIChannelProgram<ContentProgram>;
export type UIFlexProgram = UIChannelProgram<FlexProgram>;
export type UICustomProgram = UIChannelProgram<CustomProgram>;
export type UIRedirectProgram = UIChannelProgram<RedirectProgram>;

// It sucks that we have to repeat these everywhere...  but I couldn't figure out
// generic way to do it
export const isUIContentProgram = (
  p: UIChannelProgram,
): p is UIContentProgram => p.type === 'content';

export const isUIFlexProgram = (p: UIChannelProgram): p is UIFlexProgram =>
  p.type === 'flex';

export const isUICustomProgram = (p: UIChannelProgram): p is UICustomProgram =>
  p.type === 'custom';

export const isUIRedirectProgram = (
  p: UIChannelProgram,
): p is UIRedirectProgram => p.type === 'redirect';

export type UIFillerListProgram = (ContentProgram | CustomProgram) & UIIndex;
export type UICustomShowProgram = (ContentProgram | CustomProgram) & UIIndex;
export type NonUndefinedGuard<T> = T extends undefined ? never : T;

export type ProgramSelectorViewType = 'list' | 'grid';

export type SortOrder = 'asc' | 'desc';

export type AddedCustomShowProgram = {
  type: 'custom-show';
  customShowId: string;
  program: CustomProgram;
};

export type AddedPlexMedia = {
  type: Plex;
  media: TerminalProgram;
};

export type AddedJellyfinMedia = {
  type: Jellyfin;
  media: TerminalProgram;
};

export type AddedEmbyMedia = {
  type: Emby;
  media: TerminalProgram;
};

export type AddedImportedMedia = {
  type: Imported;
  media: ContentProgram;
};

/**
 * Media type going from "selected" -> "added to entity".
 */
export type AddedMedia =
  | AddedPlexMedia
  | AddedJellyfinMedia
  | AddedEmbyMedia
  | AddedCustomShowProgram
  | AddedImportedMedia;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type Prettify<Type> = Type extends Function
  ? Type
  : Extract<
      {
        [Key in keyof Type]: Type[Key];
      },
      Type
    >;

export type channelListOptions =
  | 'edit'
  | 'duplicate'
  | 'delete'
  | 'programming'
  | 'watch';
