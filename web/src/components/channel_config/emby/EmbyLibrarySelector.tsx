import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { find, first, isNil, sortBy } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Emby } from '../../../helpers/constants.ts';
import { sortEmbyLibraries } from '../../../helpers/embyUtil.ts';
import { useEmbyUserLibraries } from '../../../hooks/emby/useEmbyApi.ts';
import { Route } from '../../../routes/channels_/$channelId/programming/add.tsx';
import useStore from '../../../store/index.ts';
import {
  addKnownMediaForEmbyServer,
  setProgrammingListLibrary,
} from '../../../store/programmingSelector/actions.ts';
import { useKnownMedia } from '../../../store/programmingSelector/selectors.ts';

type Props = {
  initialLibraryId?: string;
};

export const EmbyLibrarySelector = ({ initialLibraryId }: Props) => {
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const knownMedia = useKnownMedia();
  const navigate = Route.useNavigate();

  const selectedEmbyLibrary =
    selectedLibrary?.type === Emby ? selectedLibrary.view : undefined;

  const { data: embyLibraries } = useEmbyUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Emby,
  );

  useEffect(() => {
    if (selectedServer?.type === Emby && embyLibraries) {
      if (
        embyLibraries.Items.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Emby)
      ) {
        setProgrammingListLibrary({
          type: Emby,
          view:
            find(embyLibraries.Items, ({ Id }) => Id === initialLibraryId) ??
            first(sortBy(embyLibraries.Items, sortEmbyLibraries))!,
        });
      }
      addKnownMediaForEmbyServer(selectedServer.id, embyLibraries.Items);
    }
  }, [embyLibraries, initialLibraryId, selectedLibrary, selectedServer]);

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (!selectedServer) {
        return;
      }

      const view = knownMedia.getMediaOfType(
        selectedServer.id,
        libraryUuid,
        Emby,
      );
      if (view) {
        setProgrammingListLibrary({ type: Emby, view });
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

  return (
    !isNil(embyLibraries) &&
    embyLibraries.Items.length > 0 &&
    selectedEmbyLibrary && (
      <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
        <InputLabel>Library</InputLabel>
        <Select
          label="Library"
          value={selectedEmbyLibrary.Id}
          onChange={(e) => onLibraryChange(e.target.value)}
        >
          {sortBy(embyLibraries.Items, sortEmbyLibraries).map((lib) => (
            <MenuItem key={lib.Id} value={lib.Id}>
              {lib.Name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )
  );
};
