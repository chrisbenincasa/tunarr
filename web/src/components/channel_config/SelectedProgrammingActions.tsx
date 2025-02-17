import { useDirectPlexSearch } from '@/hooks/plex/usePlexSearch.ts';
import { useAddSelectedItems } from '@/hooks/programming_controls/useAddProgramming.ts';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { useCurrentMediaSourceAndView } from '@/store/programmingSelector/selectors.ts';
import { type JellyfinMediaSourceView } from '@/store/programmingSelector/store.ts';
import {
  AddCircle,
  CheckBoxOutlineBlank,
  CheckBoxOutlined,
  Grading,
} from '@mui/icons-material';
import {
  Backdrop,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { nullToUndefined } from '@tunarr/shared/util';
import {
  type JellyfinCollectionType,
  type JellyfinItemKind,
} from '@tunarr/types/jellyfin';
import { isNil } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import useStore from '../../store/index.ts';
import {
  addJellyfinSelectedMedia,
  addKnownMediaForServer,
  addPlexSelectedMedia,
  clearSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { RotatingLoopIcon } from '../base/LoadingIcon.tsx';

type Props = {
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
  onSelectionModalClose?: () => void;
  selectAllEnabled?: boolean;
};

function collectionTypeToItemTypes(
  collectionType?: JellyfinCollectionType,
): JellyfinItemKind[] {
  if (!collectionType) {
    return ['Movie', 'Series', 'MusicArtist'];
  }

  switch (collectionType) {
    case 'movies':
      return ['Movie'];
    case 'tvshows':
      return ['Series'];
    case 'music':
      return ['MusicArtist'];
    default:
      return ['Movie', 'Series', 'MusicArtist'];
  }
}

export default function SelectedProgrammingActions({
  selectAllEnabled = true,
  toggleOrSetSelectedProgramsDrawer, // onSelectionModalClose,
}: Props) {
  const apiClient = useTunarrApi();
  const [selectedServer, selectedLibrary] = useCurrentMediaSourceAndView();
  const { urlFilter: plexSearch } = useStore(
    ({ plexSearch: plexQuery }) => plexQuery,
  );

  const selectedMedia = useStore((s) => s.selectedMedia);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const snackbar = useSnackbar();
  const { addSelectedItems, isLoading } = useAddSelectedItems();
  const removeAllItems = useCallback(() => {
    clearSelectedMedia();
  }, []);

  const directPlexSearchFn = useDirectPlexSearch(
    selectedServer,
    selectedLibrary?.type === 'plex' && selectedLibrary?.view.type === 'library'
      ? selectedLibrary.view
      : null,
    plexSearch,
    true,
  );

  const selectAllItems = () => {
    if (!isNil(selectedServer) && !isNil(selectedLibrary)) {
      removeAllItems();
      setSelectAllLoading(true);
      let prom: Promise<void>;
      switch (selectedServer.type) {
        case 'plex':
          prom = directPlexSearchFn().then((response) => {
            addPlexSelectedMedia(selectedServer, response.Metadata);
            addKnownMediaForServer(selectedServer.id, {
              type: 'plex' as const,
              items: response.Metadata ?? [],
            });
          });
          break;
        case 'jellyfin': {
          const library = selectedLibrary as JellyfinMediaSourceView;

          prom = apiClient
            .getJellyfinItems({
              params: {
                mediaSourceId: selectedServer.id,
                libraryId: library.library.Id,
              },
              queries: {
                // offset: pageParams?.offset,
                // limit: pageParams?.limit,
                itemTypes: collectionTypeToItemTypes(
                  nullToUndefined(library.library.CollectionType),
                ),
              },
            })
            .then((response) => {
              addJellyfinSelectedMedia(selectedServer, response.Items);
              addKnownMediaForServer(selectedServer.id, {
                type: 'jellyfin' as const,
                items: response.Items,
              });
            });
          break;
        }
      }

      prom
        .catch((e) => {
          console.error('Error while attempting to select all Plex items', e);
          snackbar.enqueueSnackbar(
            'Error querying Plex. Check console log and consider reporting a bug!',
            {
              variant: 'error',
            },
          );
        })
        .finally(() => setSelectAllLoading(false));
    }
  };

  return (
    <>
      <Backdrop open={open} />
      <SpeedDial
        ariaLabel="Media Action Options"
        sx={{
          position: 'fixed',
          bottom: smallViewport ? 64 : 32,
          right: 32,
        }}
        icon={<SpeedDialIcon />}
        onClose={handleClose}
        onOpen={handleOpen}
        open={open}
        FabProps={{ disabled: isLoading || selectAllLoading }}
      >
        {selectedMedia.length > 0 && (
          <SpeedDialAction
            key={'add-selected-media'}
            icon={smallViewport ? null : <AddCircle />}
            tooltipTitle={<Typography noWrap>Add Media</Typography>}
            tooltipOpen
            delay={250}
            onClick={(e) => addSelectedItems(e)}
          />
        )}

        {selectedMedia.length > 0 && (
          <SpeedDialAction
            key={'review-selections'}
            icon={smallViewport ? null : <Grading />}
            tooltipTitle={<Typography noWrap>Review</Typography>}
            tooltipOpen
            delay={750}
            onClick={() => toggleOrSetSelectedProgramsDrawer(true)}
          />
        )}

        {selectAllEnabled && (
          <SpeedDialAction
            key={'select-all-programs'}
            icon={
              smallViewport ? null : selectAllLoading ? (
                <RotatingLoopIcon />
              ) : (
                <CheckBoxOutlined />
              )
            }
            tooltipTitle={<Typography noWrap>Select All</Typography>}
            tooltipOpen
            delay={500}
            onClick={() => selectAllItems()}
          />
        )}

        {selectedMedia.length > 0 && (
          <SpeedDialAction
            key={'unselect-all-programs'}
            icon={<CheckBoxOutlineBlank />}
            tooltipTitle={<Typography noWrap>Unselect All</Typography>}
            tooltipOpen
            delay={1000}
            onClick={() => removeAllItems()}
          />
        )}
      </SpeedDial>
    </>
  );
}
