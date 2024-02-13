import { QueryClient } from '@tanstack/react-query';
import {
  ChannelProgram,
  CondensedChannelProgram,
  Program,
} from '@tunarr/types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { apiClient } from '../external/api.ts';
import { ApiOf } from '@zodios/core';
import {
  ZodiosAliases,
  ZodiosResponseByAlias,
} from '@zodios/core/lib/zodios.types';
import { UIIndex } from '../store/channelEditor/store.ts';

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
type ApiType = ApiOf<typeof apiClient>;

export type ApiAliases = keyof ZodiosAliases<ApiType>;

// For a given API endpoint alias on our Zodios instance, return
// the response type
export type ZodiosAliasReturnType<T extends ApiAliases> = Awaited<
  ZodiosResponseByAlias<ApiType, T>
>;

export type RequestMethodForAlias<T extends ApiAliases> =
  ZodiosAliases<ApiType>[T];

export type UIChannelProgram = ChannelProgram &
  UIIndex & {
    startTimeOffset: number;
  };

export type UICondensedChannelProgarm = CondensedChannelProgram & UIIndex;
