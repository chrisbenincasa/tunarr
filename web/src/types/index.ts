import { QueryClient } from '@tanstack/react-query';
import {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
  CustomProgram,
  FlexProgram,
  Program,
  RedirectProgram,
} from '@tunarr/types';
import { ApiOf } from '@zodios/core';
import {
  ZodiosAliases,
  ZodiosResponseByAlias,
} from '@zodios/core/lib/zodios.types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { type ApiClient } from '../external/api.ts';
import { EnrichedPlexMedia } from '../hooks/plex/plexHookUtil.ts';

// A program that may or may not exist in the DB yet
export type EphemeralProgram = Omit<Program, 'id'>;

export type Preloader<T> = (
  queryClient: QueryClient,
) => (args: LoaderFunctionArgs) => Promise<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PreloadedData<T extends (...args: any[]) => any> = Awaited<
  ReturnType<ReturnType<T>>
>;

// The expanded type of our API
type ApiType = ApiOf<ApiClient>;

export type ApiAliases = keyof ZodiosAliases<ApiType>;

// For a given API endpoint alias on our Zodios instance, return
// the response type
export type ZodiosAliasReturnType<T extends ApiAliases> = Awaited<
  ZodiosResponseByAlias<ApiType, T>
>;

export type RequestMethodForAlias<T extends ApiAliases> =
  ZodiosAliases<ApiType>[T];

export type UIIndex = { originalIndex: number };

export type HasStartTimeOffset = { startTimeOffset: number };

export type UICondensedChannelProgram<
  T extends CondensedChannelProgram = CondensedChannelProgram,
> = T & UIIndex & HasStartTimeOffset;

export type UICondensedContentProgram =
  UICondensedChannelProgram<CondensedChannelProgram>;
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
  p: UIRedirectProgram,
): p is UIRedirectProgram => p.type === 'redirect';

// A UIChannelProgram is a ChannelProgram with some other UI-specific fields
// The default type is any ChannelProgram (e.g. content, flex, etc) with the
// fields. We generalize here so we can effectively downcast UIChannelProgram
// to more specific program types when doing list operations.
export type UIChannelProgram<T extends ChannelProgram = ChannelProgram> = T &
  UIIndex &
  HasStartTimeOffset;

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
  type: 'plex';
  media: EnrichedPlexMedia;
};

/**
 * Media type going from "selected" -> "added to entity".
 */
export type AddedMedia = AddedPlexMedia | AddedCustomShowProgram;
