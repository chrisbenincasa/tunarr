import { useDirectPlexSearch } from '@/hooks/plex/usePlexSearch.ts';
import { useAddSelectedItems } from '@/hooks/programming_controls/useAddProgramming.ts';
import { useCurrentMediaSourceAndView } from '@/store/programmingSelector/selectors.ts';
import type { EmbyMediaSourceView } from '@/store/programmingSelector/store.ts';
import { type JellyfinMediaSourceView } from '@/store/programmingSelector/store.ts';
import { AddCircle, CheckBoxOutlined, Grading } from '@mui/icons-material';
import {
  Box,
  Button,
  Link,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { nullToUndefined } from '@tunarr/shared/util';
import { isNil } from 'lodash-es';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useState } from 'react';
import {
  getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems,
  getJellyfinLibraryItems,
} from '../../generated/sdk.gen.ts';
import { Emby, Jellyfin, Plex } from '../../helpers/constants.ts';
import { embyCollectionTypeToItemTypes } from '../../helpers/embyUtil.ts';
import { jellyfinCollectionTypeToItemTypes } from '../../helpers/jellyfinUtil.ts';
import { useIsDarkMode } from '../../hooks/useTunarrTheme.ts';
import useStore from '../../store/index.ts';
import {
  addEmbySelectedMedia,
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

export default function SelectedProgrammingActions({
  selectAllEnabled = true,
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const [selectedServer, selectedLibrary] = useCurrentMediaSourceAndView();
  const { urlFilter: plexSearch } = useStore(
    ({ plexSearch: plexQuery }) => plexQuery,
  );

  const selectedMedia = useStore((s) => s.selectedMedia);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const snackbar = useSnackbar();
  const { addSelectedItems, isLoading: addSelectedLoading } =
    useAddSelectedItems();
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
        case Plex:
          prom = directPlexSearchFn().then((response) => {
            addPlexSelectedMedia(selectedServer, response.Metadata);
            addKnownMediaForServer(selectedServer.id, {
              type: 'plex' as const,
              items: response.Metadata ?? [],
            });
          });
          break;
        case Jellyfin: {
          const library = selectedLibrary as JellyfinMediaSourceView;

          prom = getJellyfinLibraryItems({
            path: {
              mediaSourceId: selectedServer.id,
              libraryId: library.view.ItemId,
            },
            query: {
              itemTypes: jellyfinCollectionTypeToItemTypes(
                nullToUndefined(library.view.CollectionType),
              ),
              recursive: true,
            },
            throwOnError: true,
          }).then(({ data: response }) => {
            addJellyfinSelectedMedia(selectedServer, response.Items);
            addKnownMediaForServer(selectedServer.id, {
              type: Jellyfin,
              items: response.Items,
            });
          });
          break;
        }
        case Emby: {
          const library = selectedLibrary as EmbyMediaSourceView;

          prom = getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems({
            path: {
              mediaSourceId: selectedServer.id,
              libraryId: library.view.Id,
            },
            query: {
              itemTypes: embyCollectionTypeToItemTypes(
                library.view.CollectionType,
              ),
            },
            throwOnError: true,
          }).then(({ data: response }) => {
            addEmbySelectedMedia(selectedServer, response.Items);
            addKnownMediaForServer(selectedServer.id, {
              type: Emby,
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

  const darkMode = useIsDarkMode();

  return (
    <Stack
      direction={{ sm: 'column', md: 'row' }}
      spacing={{ sm: 1, md: 4 }}
      sx={{
        display: 'flex',
        justifyContent: 'start',
        alignItems: 'center',
        position: 'sticky',
        top: '64px',
        backgroundColor: (theme) =>
          darkMode ? theme.palette.background.paper : theme.palette.grey[400],
        zIndex: 9,
        mx: -3,
        pl: 3,
        pr: 6,
        py: 1,
      }}
    >
      <Box>
        {`${selectedMedia.length} ${pluralize('Selected Item', selectedMedia.length)}`}

        {selectedMedia.length > 0 && (
          <Link
            onClick={() => removeAllItems()}
            sx={{ ml: 1, cursor: 'pointer', mr: 4 }}
          >
            Clear
          </Link>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
        {selectAllEnabled && (
          <Button
            key={'select-all-programs'}
            variant="outlined"
            startIcon={
              smallViewport ? null : selectAllLoading ? (
                <RotatingLoopIcon />
              ) : (
                <CheckBoxOutlined />
              )
            }
            onClick={() => selectAllItems()}
            disabled={selectAllLoading || addSelectedLoading}
            sx={{ m: 0.5, flexGrow: 1 }}
          >
            {smallViewport && selectAllEnabled ? (
              <RotatingLoopIcon />
            ) : (
              'Select All'
            )}
          </Button>
        )}

        {selectedMedia.length > 0 && (
          <>
            <Button
              key={'review-selections'}
              variant="outlined"
              startIcon={smallViewport ? null : <Grading />}
              onClick={() => toggleOrSetSelectedProgramsDrawer(true)}
              sx={{ m: 0.5, flexGrow: 1 }}
            >
              {smallViewport ? 'Review' : 'Review Selections'}
            </Button>
            <Button
              key={'add-selected-media'}
              variant="contained"
              startIcon={
                smallViewport ? null : addSelectedLoading ? (
                  <RotatingLoopIcon />
                ) : (
                  <AddCircle />
                )
              }
              onClick={(e) => addSelectedItems(e)}
              disabled={selectAllLoading || addSelectedLoading}
              sx={{ m: 0.5, flexGrow: 1 }}
            >
              {smallViewport ? 'Add Media' : 'Add Selected Media'}
            </Button>
          </>
        )}
      </Box>
    </Stack>
  );
}
