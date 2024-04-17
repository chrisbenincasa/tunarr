import { find, memoize } from 'lodash-es';
import { uuidRegexPattern } from '../helpers/util';

type Route = { matcher: RegExp; name: string };

const entityPageMatcher = (entity: string, path: string) =>
  new RegExp(`^/${entity}/${uuidRegexPattern}/${path}/?$`);

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
    matcher: channelsPageMatcher('programming/random-slot-editor'),
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
