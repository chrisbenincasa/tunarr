import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { MediaSourceLibrary } from '@tunarr/types';
import { find, orderBy, sortBy } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Imported } from '../../helpers/constants.ts';
import { useMediaSourceLibraries } from '../../hooks/media-sources/useMediaSourceLibraries.ts';
import { useProgrammingSelectionContext } from '../../hooks/useProgrammingSelectionContext.ts';
import useStore from '../../store/index.ts';
import { setProgrammingListLibrary } from '../../store/programmingSelector/actions.ts';

function sortLibraries(lib: MediaSourceLibrary): number {
  const factor = lib.enabled && lib.lastScannedAt ? -1 : 1;
  switch (lib.mediaType) {
    case 'shows':
      return factor * 4;
    case 'movies':
      return factor * 3;
    case 'tracks':
      return factor * 2;
    case 'other_videos':
    case 'music_videos':
      return factor * 1;
  }
}

function getLibraryNameString(lib: MediaSourceLibrary) {
  if (!lib.enabled) {
    return `${lib.name} (disabled)`;
  }

  if (!lib.lastScannedAt) {
    return `${lib.name} (not scanned)`;
  }

  return lib.name;
}

type Props = {
  initialLibraryId?: string;
};

export const ImportedLibrarySelector = ({ initialLibraryId }: Props) => {
  const { onSourceChange } = useProgrammingSelectionContext();
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);

  const selectedImportedLibrary =
    selectedLibrary?.type === Imported ? selectedLibrary.view : undefined;

  const { data: libraries } = useMediaSourceLibraries(
    selectedServer?.id ?? '',
    {
      enabled: isNonEmptyString(selectedServer?.id),
    },
  );

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
      }
    }
  }, [
    initialLibraryId,
    libraries,
    selectedImportedLibrary,
    selectedLibrary,
    selectedServer,
  ]);

  const handleLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }
      const library = libraries?.find((lib) => lib.id === libraryUuid);
      if (!library) {
        return;
      }

      setProgrammingListLibrary({ type: Imported, view: library });
      onSourceChange({ libraryId: library.id });
    },
    [selectedServer, libraries, onSourceChange],
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
            onChange={(e) => handleLibraryChange(e.target.value)}
          >
            {orderBy(libraries, sortLibraries, 'desc').map((lib) => (
              <MenuItem
                key={lib.id}
                value={lib.id}
                disabled={!lib.enabled || !lib.lastScannedAt}
                sx={{
                  fontStyle:
                    lib.enabled && lib.lastScannedAt ? undefined : 'italic',
                }}
              >
                {getLibraryNameString(lib)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </>
    )
  );
};
