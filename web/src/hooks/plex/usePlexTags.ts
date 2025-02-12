import { useCurrentPlexMediaSourceAndLibraryView } from '@/store/programmingSelector/selectors.ts';
import { useQuery } from '@tanstack/react-query';
import { getApiPlexByMediaSourceIdTagsOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const usePlexTags = (key: string) => {
  const [selectedServer, selectedLibrary] =
    useCurrentPlexMediaSourceAndLibraryView();

  return useQuery({
    ...getApiPlexByMediaSourceIdTagsOptions({
      path: {
        mediaSourceId: selectedServer?.id ?? '',
      },
      query: {
        libraryKey: selectedLibrary?.library.externalId ?? '',
        itemKey: key,
      },
    }),
    enabled: !!selectedServer && !!selectedLibrary,
  });
};
