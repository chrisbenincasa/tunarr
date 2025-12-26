import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { useCallback } from 'react';
import { setSearchRequest } from '../../store/programmingSelector/actions.ts';
import { SearchBuilder } from '../search/SearchBuilder.tsx';

type Props = {
  mediaSource?: MediaSourceSettings;
  library?: MediaSourceLibrary;
  initialSearchQuery?: string;
};

export const SearchInput = (props: Props) => {
  const { initialSearchQuery } = props;

  const handleSearchChange = useCallback((searchRequest: SearchRequest) => {
    setSearchRequest(searchRequest);
  }, []);

  return (
    <SearchBuilder
      onSearch={handleSearchChange}
      initialQuery={initialSearchQuery}
      mediaTypeFilter={
        props.mediaSource?.type === 'local'
          ? props.mediaSource.mediaType
          : props.library?.mediaType
      }
    />
  );
};
