import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { tag } from '@tunarr/types';
import { capitalize, find, isEmpty, isNil, sortBy } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Jellyfin } from '../../../helpers/constants.ts';
import { sortJellyfinLibraries } from '../../../helpers/jellyfinUtil.ts';
import {
  useJellyfinGenres,
  useJellyfinUserLibraries,
} from '../../../hooks/jellyfin/useJellyfinApi.ts';
import { Route } from '../../../routes/channels_/$channelId/programming/add.tsx';
import useStore from '../../../store/index.ts';
import {
  addKnownMediaForJellyfinServer,
  setProgrammingGenre,
  setProgrammingListLibrary,
} from '../../../store/programmingSelector/actions.ts';
import { useKnownMedia } from '../../../store/programmingSelector/selectors.ts';

type Props = {
  initialLibraryId?: string;
};

export const JellyfinLibrarySelector = ({ initialLibraryId }: Props) => {
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const navigate = Route.useNavigate();
  const knownMedia = useKnownMedia();
  const selectedGenre = useStore((s) => s.currentMediaGenre);

  const { data: jellyfinLibraries } = useJellyfinUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Jellyfin,
  );

  const selectedJellyfinLibrary =
    selectedLibrary?.type === Jellyfin ? selectedLibrary.view : undefined;

  const { data: jellyfinGenres } = useJellyfinGenres(
    selectedServer?.id ?? tag(''),
    selectedJellyfinLibrary?.Id ?? '',
    selectedServer?.type === Jellyfin && !!selectedJellyfinLibrary,
  );

  useEffect(() => {
    if (selectedServer?.type === Jellyfin && jellyfinLibraries) {
      if (
        jellyfinLibraries.Items.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Jellyfin)
      ) {
        const view =
          find(
            jellyfinLibraries.Items,
            ({ Id: id }) => id === initialLibraryId,
          ) ?? sortBy(jellyfinLibraries.Items, sortJellyfinLibraries)[0];
        setProgrammingListLibrary({
          type: Jellyfin,
          view,
        });
        navigate({
          search: {
            libraryId: view.Id,
            mediaSourceId: selectedServer.id,
          },
        }).catch(console.error);
      }
      addKnownMediaForJellyfinServer(selectedServer.id, [
        ...jellyfinLibraries.Items,
      ]);
    }
  }, [
    initialLibraryId,
    jellyfinLibraries,
    navigate,
    selectedLibrary,
    selectedServer,
  ]);

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }
      const view = knownMedia.getMediaOfType(
        selectedServer.id,
        libraryUuid,
        Jellyfin,
      );
      if (view) {
        setProgrammingListLibrary({ type: Jellyfin, view });
        navigate({
          search: {
            mediaSourceId: selectedServer.id,
            libraryId: view.Id,
          },
        }).catch(console.error);
      }
    },
    [knownMedia, navigate, selectedServer],
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
    jellyfinLibraries.Items.length > 0 &&
    selectedJellyfinLibrary && (
      <>
        <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
          <InputLabel>Library</InputLabel>
          <Select
            label="Library"
            value={selectedJellyfinLibrary.Id}
            onChange={(e) => onLibraryChange(e.target.value)}
          >
            {sortBy(jellyfinLibraries.Items, sortJellyfinLibraries).map(
              (lib) => (
                <MenuItem key={lib.Id} value={lib.Id}>
                  {lib.Name}
                </MenuItem>
              ),
            )}
          </Select>
        </FormControl>
        {renderGenreChoices()}
      </>
    )
  );
};
