import { find, memoize } from 'lodash-es';

type Route = { matcher: RegExp; name: string };

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
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\/watch$/g,
    name: 'Watch',
  },
  {
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\/edit$/g,
    name: 'Edit',
  },
  {
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\/programming$/g,
    name: 'Programming',
  },
  {
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\/programming\/add$/g,
    name: 'Add',
  },
  {
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\/programming\/time-slot-editor$/g,
    name: 'Time Slot Editor',
  },
  {
    matcher:
      /^\/channels\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\/programming\/random-slot-editor$/g,
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
  console.log(path);
  return find(namedRoutes, ({ matcher }) => {
    return matcher.test(path);
  })?.name;
});

export const useGetRouteName = () => {
  return (path: string) => getRouteName(path);
};
