import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { find, isNil, sortBy } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Emby } from '../../../helpers/constants.ts';
import { sortJellyfinLibraries } from '../../../helpers/jellyfinUtil.ts';
import { useEmbyUserLibraries } from '../../../hooks/emby/useEmbyApi.ts';
import { useProgrammingSelectionContext } from '../../../hooks/useProgrammingSelectionContext.ts';
import useStore from '../../../store/index.ts';
import { setProgrammingListLibrary } from '../../../store/programmingSelector/actions.ts';

type Props = {
  initialLibraryId?: string;
};

export const EmbyLibrarySelector = ({ initialLibraryId }: Props) => {
  const { onSourceChange } = useProgrammingSelectionContext();
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);

  const { data: embyLibraries } = useEmbyUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Emby,
  );

  const selectedEmbyLibrary =
    selectedLibrary?.type === Emby ? selectedLibrary.view : undefined;

  useEffect(() => {
    if (selectedServer?.type === Emby && embyLibraries) {
      if (
        embyLibraries.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Emby)
      ) {
        const validLibraries = embyLibraries;
        const view =
          find(validLibraries, ({ uuid: id }) => id === initialLibraryId) ??
          sortBy(validLibraries, sortJellyfinLibraries)[0];

        setProgrammingListLibrary({
          type: Emby,
          view,
        });
        onSourceChange({ libraryId: view.externalId });
      }
      // addKnownMediaForJellyfinServer(selectedServer.id, [...jellyfinLibraries]);
    }
  }, [
    initialLibraryId,
    embyLibraries,
    selectedLibrary,
    selectedServer,
    onSourceChange,
  ]);

  const handleLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }
      const view = embyLibraries?.find((lib) => lib.uuid === libraryUuid);
      if (view) {
        setProgrammingListLibrary({
          type: Emby,
          view,
        });
        onSourceChange({ libraryId: view.externalId });
      }
    },
    [embyLibraries, onSourceChange, selectedServer],
  );

  return (
    !isNil(embyLibraries) &&
    embyLibraries.length > 0 &&
    selectedEmbyLibrary && (
      <>
        <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
          <InputLabel>Library</InputLabel>
          <Select
            label="Library"
            value={selectedEmbyLibrary.uuid}
            onChange={(e) => handleLibraryChange(e.target.value)}
          >
            {sortBy(embyLibraries, sortJellyfinLibraries).map((lib) => (
              <MenuItem key={lib.externalId} value={lib.uuid}>
                {lib.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </>
    )
  );
};
