import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { capitalize, find, isEmpty, isNil, sortBy } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Jellyfin } from '../../../helpers/constants.ts';
import { sortJellyfinLibraries } from '../../../helpers/jellyfinUtil.ts';
import {
  useJellyfinGenres,
  useJellyfinUserLibraries,
} from '../../../hooks/jellyfin/useJellyfinApi.ts';
import { useProgrammingSelectionContext } from '../../../hooks/useProgrammingSelectionContext.ts';
import useStore from '../../../store/index.ts';
import {
  setProgrammingGenre,
  setProgrammingListLibrary,
} from '../../../store/programmingSelector/actions.ts';

type Props = {
  initialLibraryId?: string;
};

export const JellyfinLibrarySelector = ({ initialLibraryId }: Props) => {
  const { onSourceChange } = useProgrammingSelectionContext();
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const selectedGenre = useStore((s) => s.currentMediaGenre);

  const { data: jellyfinLibraries } = useJellyfinUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Jellyfin,
  );

  const selectedJellyfinLibrary =
    selectedLibrary?.type === Jellyfin ? selectedLibrary.view : undefined;

  const { data: jellyfinGenres } = useJellyfinGenres(
    selectedServer?.id ?? '',
    selectedJellyfinLibrary?.externalId ?? '',
    selectedServer?.type === Jellyfin && !!selectedJellyfinLibrary,
  );

  useEffect(() => {
    if (selectedServer?.type === Jellyfin && jellyfinLibraries) {
      if (
        jellyfinLibraries.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Jellyfin)
      ) {
        const validLibraries = jellyfinLibraries;
        const view =
          find(validLibraries, ({ uuid: id }) => id === initialLibraryId) ??
          sortBy(validLibraries, sortJellyfinLibraries)[0];

        setProgrammingListLibrary({
          type: Jellyfin,
          view,
        });
        onSourceChange({ libraryId: view.externalId });
      }
      // addKnownMediaForJellyfinServer(selectedServer.id, [...jellyfinLibraries]);
    }
  }, [
    initialLibraryId,
    jellyfinLibraries,
    selectedLibrary,
    selectedServer,
    onSourceChange,
  ]);

  const handleLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }

      const view = jellyfinLibraries?.find((lib) => lib.uuid === libraryUuid);

      if (view) {
        setProgrammingListLibrary({
          type: Jellyfin,
          view,
        });
        onSourceChange({ libraryId: view.externalId });
      }
    },
    [jellyfinLibraries, onSourceChange, selectedServer],
  );

  const renderGenreChoices = () => {
    const genreList = jellyfinGenres?.Items ?? [];
    return (
      <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
        <InputLabel>Genre</InputLabel>
        <Select
          label="Genre"
          value={selectedGenre ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setProgrammingGenre(value === '' ? undefined : value);
          }}
        >
          <MenuItem value="">
            <em>All Genres</em>
          </MenuItem>
          {seq.collect(genreList, (genre) => {
            if (isEmpty(genre.Name)) {
              return;
            }

            return (
              <MenuItem key={genre.Id} value={genre.Name ?? ''}>
                {capitalize(genre.Name ?? '')}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    );
  };

  return (
    !isNil(jellyfinLibraries) &&
    jellyfinLibraries.length > 0 &&
    selectedJellyfinLibrary && (
      <>
        <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
          <InputLabel>Library</InputLabel>
          <Select
            label="Library"
            value={selectedJellyfinLibrary.uuid}
            onChange={(e) => handleLibraryChange(e.target.value)}
          >
            {sortBy(jellyfinLibraries, sortJellyfinLibraries).map((lib) => (
              <MenuItem key={lib.externalId} value={lib.uuid}>
                {lib.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {renderGenreChoices()}
      </>
    )
  );
};
