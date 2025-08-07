import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { MediaSourceLibrary } from '@tunarr/types';
import { tag } from '@tunarr/types';
import { find, sortBy } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Imported } from '../../helpers/constants.ts';
import { useMediaSourceLibraries } from '../../hooks/media-sources/useMediaSourceLibraries.ts';
import { Route } from '../../routes/channels_/$channelId/programming/add.tsx';
import useStore from '../../store/index.ts';
import { setProgrammingListLibrary } from '../../store/programmingSelector/actions.ts';
import { useKnownMedia } from '../../store/programmingSelector/selectors.ts';

function sortLibraries(lib: MediaSourceLibrary): number {
  switch (lib.mediaType) {
    case 'shows':
      return 0;
    case 'movies':
      return 1;
    case 'tracks':
      return 2;
    case 'other_videos':
    case 'music_videos':
      return 10;
  }
}

type Props = {
  initialLibraryId?: string;
};

export const ImportedLibrarySelector = ({ initialLibraryId }: Props) => {
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const navigate = Route.useNavigate();
  const knownMedia = useKnownMedia();
  const selectedGenre = useStore((s) => s.currentMediaGenre);

  const selectedImportedLibrary =
    selectedLibrary?.type === Imported ? selectedLibrary.view : undefined;

  const { data: libraries } = useMediaSourceLibraries(
    selectedServer?.id ?? tag(''),
    isNonEmptyString(selectedServer?.id),
  );
  console.log(selectedLibrary);

  useEffect(() => {
    if (selectedServer && libraries) {
      if (libraries.length > 0 && !selectedImportedLibrary) {
        const view =
          find(libraries, ({ id }) => id === initialLibraryId) ??
          sortBy(libraries, sortLibraries)[0];
        setProgrammingListLibrary({
          type: Imported,
          view,
        });
        navigate({
          search: {
            libraryId: view.id,
            mediaSourceId: selectedServer.id,
          },
        }).catch(console.error);
        console.log(view);
      }
    }
  }, [
    initialLibraryId,
    libraries,
    navigate,
    selectedImportedLibrary,
    selectedLibrary,
    selectedServer,
  ]);

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }

      // const view = knownMedia.getMediaOfType(
      //   selectedServer.id,
      //   libraryUuid,
      //   Imported,
      // );
      const library = libraries?.find((lib) => lib.id === libraryUuid);
      if (!library) {
        return;
      }

      setProgrammingListLibrary({ type: Imported, view: library });
      navigate({
        search: {
          mediaSourceId: selectedServer.id,
          libraryId: library.id,
        },
      }).catch(console.error);
    },
    [libraries, navigate, selectedServer],
  );

  return (
    (libraries?.length ?? 0) > 0 &&
    selectedImportedLibrary && (
      <>
        <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
          <InputLabel>Library</InputLabel>
          <Select
            label="Library"
            value={selectedImportedLibrary?.id}
            onChange={(e) => onLibraryChange(e.target.value)}
          >
            {sortBy(libraries, sortLibraries).map((lib) => (
              <MenuItem key={lib.id} value={lib.id}>
                {lib.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </>
    )
  );
};
