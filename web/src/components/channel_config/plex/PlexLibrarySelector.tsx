import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { find, isNil, map } from 'lodash-es';
import { useCallback, useContext, useEffect } from 'react';
import { ProgrammingSelectionContext } from '../../../context/ProgrammingSelectionContext.ts';
import { Plex } from '../../../helpers/constants.ts';
import {
  usePlexLibraries,
  usePlexPlaylists,
} from '../../../hooks/plex/usePlex.ts';
import useStore from '../../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListLibrary,
} from '../../../store/programmingSelector/actions.ts';
import { useKnownMedia } from '../../../store/programmingSelector/selectors.ts';

type Props = {
  initialLibraryId?: string;
};

export const PlexLibrarySelector = ({ initialLibraryId }: Props) => {
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const selectionCtx = useContext(ProgrammingSelectionContext);

  const { data: plexLibraryChildren } = usePlexLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Plex,
  );

  const { data: plexPlaylists, isLoading: plexPlaylistsLoading } =
    usePlexPlaylists(selectedServer?.id ?? '', selectedServer?.type === Plex);

  const knownMedia = useKnownMedia();

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }

      if (libraryUuid === 'playlists' && plexPlaylists) {
        setProgrammingListLibrary({
          type: Plex,
          view: { type: 'playlists', playlists: plexPlaylists.result },
        });
        return;
      }

      const library = knownMedia.getPlexMedia(selectedServer.id, libraryUuid);

      if (library?.type === 'library') {
        setProgrammingListLibrary({
          type: Plex,
          view: { type: 'library', library },
        });
        selectionCtx?.onSourceChange({
          mediaSourceId: selectedServer.id,
          libraryId: library.uuid,
        });
      } else {
        console.warn('Not found in local store', libraryUuid);
      }
    },
    [knownMedia, plexPlaylists, selectionCtx, selectedServer],
  );

  useEffect(() => {
    if (selectedServer && plexLibraryChildren) {
      addKnownMediaForServer(selectedServer.id, [...plexLibraryChildren]);

      if (
        plexLibraryChildren.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Plex)
      ) {
        const initialLibrary = find(
          plexLibraryChildren,
          ({ externalId }) => externalId === initialLibraryId,
        );
        setProgrammingListLibrary({
          type: Plex,
          view: {
            type: 'library',
            library: initialLibrary ?? plexLibraryChildren[0],
          },
        });
        selectionCtx?.onSourceChange({
          libraryId: plexLibraryChildren[0].externalId,
          mediaSourceId: selectedServer.id,
        });
      }
    }
  }, [
    initialLibraryId,
    plexLibraryChildren,
    selectedLibrary,
    selectedServer,
    selectionCtx,
  ]);

  const selectedPlexLibrary =
    selectedLibrary?.type === Plex ? selectedLibrary.view : undefined;

  const hasLibraries =
    !isNil(plexLibraryChildren) &&
    plexLibraryChildren.length > 0 &&
    selectedPlexLibrary;

  const libraryMenuItems = map(plexLibraryChildren, (dir) => (
    <MenuItem key={dir.externalId} value={dir.uuid}>
      {dir.title}
    </MenuItem>
  ));

  const playlistMenuItem = (
    <MenuItem key="playlists" value="playlists" disabled={plexPlaylistsLoading}>
      Playlists
    </MenuItem>
  );

  return (
    hasLibraries && (
      <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
        <InputLabel>Library</InputLabel>
        <Select
          label="Library"
          value={
            selectedPlexLibrary.type === 'library'
              ? selectedPlexLibrary.library.uuid
              : 'playlists'
          }
          onChange={(e) => onLibraryChange(e.target.value)}
        >
          {libraryMenuItems}
          {playlistMenuItem}
        </Select>
      </FormControl>
    )
  );
};
