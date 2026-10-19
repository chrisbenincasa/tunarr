import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AutoChannelCreateRequest,
  ContentPreviewResponse,
  ContentQuery,
} from '@tunarr/types/api';
import { ContentPreviewResponseSchema } from '@tunarr/types/api';
import { getApiAutoChannelsPresetsOptions } from '../generated/@tanstack/react-query.gen.ts';
import {
  postApiAutoChannelsCreate,
  postApiAutoChannelsPreviewContent,
} from '../generated/sdk.gen.ts';
import { isEqual } from 'lodash-es';
import { useDebounceValue } from 'usehooks-ts';
import { invalidateTaggedQueries } from '../helpers/queryUtil.ts';

export function useAutoChannelPresets() {
  return useQuery(getApiAutoChannelsPresetsOptions());
}

export type RolePreview = {
  data: ContentPreviewResponse | undefined;
  isLoading: boolean;
  error: Error | null;

  // The role's picker has no selection yet, so nothing was fetched.
  awaitingInput: boolean;
};

/**
 * Previews every role's content. A role whose query is undefined is waiting
 * for input and fetches nothing. Each role refetches only when its own query
 * changes, and edits settle for a moment before they fire.
 */
export function useRolePreviews(
  queries: Record<string, ContentQuery | undefined>,
): Record<string, RolePreview> {
  const [settled] = useDebounceValue(queries, 400, { equalityFn: isEqual });
  const roles = Object.keys(settled);

  const results = useQueries({
    queries: roles.map((role) => {
      const query = settled[role];
      return queryOptions({
        queryKey: ['auto-channel', 'preview', query ?? null],
        queryFn: async () => {
          if (query === undefined) {
            throw new Error(`Role ${role} has no query to preview`);
          }

          const { data } = await postApiAutoChannelsPreviewContent({
            body: query,
            throwOnError: true,
          });

          // OpenAPI widens the enum-keyed byType record to string keys.
          return ContentPreviewResponseSchema.parse(data);
        },
        enabled: query !== undefined,
        placeholderData: keepPreviousData,
      });
    }),
  });

  const previews: Record<string, RolePreview> = {};
  roles.forEach((role, i) => {
    const result = results[i];
    if (!result) {
      return;
    }

    if (queries[role] === undefined) {
      previews[role] = {
        data: undefined,
        isLoading: false,
        error: null,
        awaitingInput: true,
      };
      return;
    }

    previews[role] = {
      data: settled[role] === undefined ? undefined : result.data,
      isLoading: result.isFetching || !isEqual(queries[role], settled[role]),
      error: result.error,
      awaitingInput: false,
    };
  });
  return previews;
}

export function useAutoCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AutoChannelCreateRequest) => {
      const { data } = await postApiAutoChannelsCreate({
        body: request,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Channels'),
      });
    },
  });
}
