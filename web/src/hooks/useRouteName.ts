import { find, memoize } from 'lodash-es';

type Route = { matcher: RegExp; name: string };

const uuidRegexPattern =
  '[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}';

const entityPageMatcher = (entity: string, path: string) =>
  new RegExp(`^\/${entity}\/${uuidRegexPattern}\/${path}\/?$`);

const channelsPageMatcher = (path: string) =>
  entityPageMatcher('channels', path);

const customShowsPageMatcher = (path: string) =>
  entityPageMatcher('library/custom-shows', path);

const namedRoutes: Route[] = [
  {
    matcher: /^\/channels$/g,
    name: 'Channels',
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
    matcher: channelsPageMatcher('time-slot-editor'),
    name: 'Time Slot Editor',
  },
  {
    matcher: channelsPageMatcher('random-slot-editor'),
    name: 'Random Slot Editor',
  },
  {
    matcher: /^\/library$/g,
    name: 'Library',
  },
  {
    matcher: /^\/library\/fillers$/g,
    name: 'Fillers',
  },
  {
    matcher: /^\/library\/fillers\/new$/g,
    name: 'New',
  },
  {
    matcher: /^\/library\/custom-shows$/g,
    name: 'Custom Shows',
  },
  {
    matcher: /^\/library\/custom-shows\/new$/g,
    name: 'New',
  },
];

const getRouteName = memoize((path: string) => {
  return find(namedRoutes, ({ matcher }) => {
    return matcher.test(path);
  })?.name;
});

export const useGetRouteName = () => {
  return (path: string) => getRouteName(path);
};
