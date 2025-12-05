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
        name: 'Channels',
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
        name: 'New',
      },
      {
        matcher: channelsPageMatcher('watch'),
        name: 'Watch',
      },
      {
        matcher: channelsPageMatcher('edit'),
        name: 'Edit',
      },
      {
        matcher: channelsPageMatcher('edit/flex'),
        name: 'Flex',
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
        name: 'Edit',
      },
      {
        matcher: channelsPageMatcher('programming'),
        name: 'Programming',
      },
      {
        matcher: channelsPageMatcher('programming/add'),
        name: 'Add',
      },
      {
        matcher: channelsPageMatcher('programming/time-slot-editor'),
        name: 'Time Slot Editor',
      },
      {
        matcher: channelsPageMatcher('programming/slot-editor'),
        name: 'Slot Editor',
      },
      {
        matcher: /^\/library$/g,
        name: 'Library',
      },
      {
        matcher: /^\/library\/fillers$/g,
        name: 'Filler Lists',
      },
      {
        matcher: new RegExp(
          `^/library/fillers/(new|${uuidRegexPattern})/programming/?$`,
        ),
        name: 'Add Programming',
      },
      {
        matcher: entityPageMatcher('library/fillers', 'edit'),
        name: 'Edit',
      },
      {
        matcher: /^\/library\/fillers\/new$/g,
        name: 'New',
      },
      {
        matcher: /^\/library\/smart_collections$/g,
        name: 'Smart Collections',
      },
      {
        matcher: /^\/library\/custom-shows$/g,
        name: 'Custom Shows',
      },
      {
        matcher: /^\/library\/custom-shows\/new$/g,
        name: 'New',
      },
      {
        matcher: /^\/library\/trash$/g,
        name: 'Trash',
      },
      {
        matcher: new RegExp(
          `^/library/custom-shows/(new|${uuidRegexPattern})/programming/?$`,
        ),
        name: 'Add Programming',
      },
      {
        matcher: /^\/settings\/ffmpeg$/g,
        name: 'FFmpeg Settings',
      },
      {
        matcher: entityPageMatcher('settings/ffmpeg', ''),
        name: 'Edit Transcode Config',
      },
      {
        matcher: entityPageMatcher('library', ''),
        name: 'Search',
      },
      {
        matcher: /^\/media_sources$/g,
        name: 'Media Sources',
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
