import { memoize, find } from 'lodash-es';

type Route = { matcher: RegExp; name: string };

const namedRoutes: Route[] = [
  {
    matcher: /^\/channels$/g,
    name: 'Channels',
  },
  {
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/g,
    name: 'Channel Edit',
  },
];

const getRouteName = memoize((path: string) => {
  console.log(path);
  return find(namedRoutes, ({ matcher }) => {
    return matcher.test(path);
  })?.name;
});

export const useGetRouteName = () => {
  return (path: string) => getRouteName(path);
};
