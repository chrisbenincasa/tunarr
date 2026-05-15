import { t } from '@lingui/core/macro';
import { isString } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { isNonEmptyString, uuidRegexPattern } from '../helpers/util';
import type { State } from '../store/index.ts';
import useStore from '../store/index.ts';
import type { Maybe } from '../types/util.ts';

type RouteCallback = (s: State, maybeEntityId?: string) => string | undefined;

type Route = {
  matcher: RegExp;
  name: string | RouteCallback;
  to?: string;
  isLink?: boolean;
};

type RouteDetails = { name: Maybe<string>; isLink: boolean; to?: string };

const entityPageMatcher = (entity: string, path: string) => {
  const pathPart = isNonEmptyString(path) ? `/${path}` : '';
  return new RegExp(
    `^/${entity}/(?<entityId>${uuidRegexPattern})${pathPart}/?$`,
  );
};

const channelsPageMatcher = (path: string) =>
  entityPageMatcher('channels', path);

const customShowsPageMatcher = (path: string) =>
  entityPageMatcher('library/custom-shows', path);

const useNamedRoutes = () => {
  return useMemo(
    (): Route[] => [
      {
        matcher: /^\/channels$/g,
        name: t`Channels`,
      },
      {
        matcher: channelsPageMatcher(''),
        name: (store, maybeId) =>
          isNonEmptyString(maybeId) &&
          store.channelEditor.currentEntity?.id === maybeId
            ? store.channelEditor.currentEntity.name
            : undefined,
        // name: (store) => store.channelEditor.,
      },
      {
        matcher: /^\/channels\/new$/g,
        name: t`New`,
      },
      {
        matcher: channelsPageMatcher('watch'),
        name: t`Watch`,
      },
      {
        matcher: channelsPageMatcher('edit'),
        name: t`Edit`,
      },
      {
        matcher: channelsPageMatcher('edit/flex'),
        name: t`Flex`,
      },
      {
        matcher: channelsPageMatcher('edit/ffmpeg'),
        name: 'FFMPEG',
      },
      {
        matcher: channelsPageMatcher('edit/epg'),
        name: 'EPG',
      },
      {
        matcher: customShowsPageMatcher('edit'),
        name: t`Edit`,
      },
      {
        matcher: channelsPageMatcher('programming'),
        name: t`Programming`,
      },
      {
        matcher: channelsPageMatcher('programming/add'),
        name: t`Add`,
      },
      {
        matcher: channelsPageMatcher('programming/time-slot-editor'),
        name: t`Time Slot Editor`,
      },
      {
        matcher: channelsPageMatcher('programming/slot-editor'),
        name: t`Slot Editor`,
      },
      {
        matcher: /^\/library$/g,
        name: t`Library`,
      },
      {
        matcher: /^\/library\/fillers$/g,
        name: t`Filler Lists`,
      },
      {
        matcher: new RegExp(
          `^/library/fillers/(new|${uuidRegexPattern})/programming/?$`,
        ),
        name: t`Add Programming`,
      },
      {
        matcher: entityPageMatcher('library/fillers', 'edit'),
        name: t`Edit`,
      },
      {
        matcher: /^\/library\/fillers\/new$/g,
        name: t`New`,
      },
      {
        matcher: /^\/library\/smart_collections$/g,
        name: t`Smart Collections`,
      },
      {
        matcher: /^\/library\/custom-shows$/g,
        name: t`Custom Shows`,
      },
      {
        matcher: /^\/library\/custom-shows\/new$/g,
        name: t`New`,
      },
      {
        matcher: /^\/library\/trash$/g,
        name: t`Trash`,
      },
      {
        matcher: new RegExp(
          `^/library/custom-shows/(new|${uuidRegexPattern})/programming/?$`,
        ),
        name: t`Add Programming`,
      },
      {
        matcher: /^\/settings\/ffmpeg$/g,
        name: t`FFmpeg Settings`,
      },
      {
        matcher: entityPageMatcher('settings/ffmpeg', ''),
        name: t`Edit Transcode Config`,
      },
      {
        matcher: /^\/profiles\/transcode$/g,
        name: t`Transcode Configs`,
      },
      {
        matcher: entityPageMatcher('profiles/transcode', ''),
        name: t`Edit Transcode Config`,
      },
      {
        matcher: entityPageMatcher('library', ''),
        name: t`Search`,
      },
      {
        matcher: /^\/media_sources$/g,
        name: t`Media Sources`,
        to: '/library',
      },
      {
        matcher: entityPageMatcher('media_sources', ''),
        name: '<replace me>',
      },
    ],
    [],
  );
};

export const useGetRouteDetails = () => {
  const store = useStore();
  const namedRoutes = useNamedRoutes();

  const getRoute = useCallback(
    (path: string) => {
      let route: Maybe<Route>;
      let maybeId: Maybe<string>;
      for (const namedRoute of namedRoutes) {
        const matches = path.match(namedRoute.matcher);
        if (matches) {
          route = namedRoute;
          maybeId = matches.groups?.['entityId'];
          break;
        }
      }

      if (!route) {
        return;
      }

      const name = isString(route.name)
        ? route.name
        : route.name(store, maybeId);

      return {
        name,
        isLink: route.isLink ?? true,
        to: route.to,
      } satisfies RouteDetails;
    },
    [namedRoutes, store],
  );

  return getRoute;
};
