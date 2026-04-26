import { useAddSelectedItems } from '@/hooks/programming_controls/useAddProgramming.ts';
import { useCurrentMediaSourceAndView } from '@/store/programmingSelector/selectors.ts';
import type { SelectedMedia } from '@/store/programmingSelector/store.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { AddCircle, CheckBoxOutlined, Grading } from '@mui/icons-material';
import {
  Box,
  Button,
  Link,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { isNil } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { match, P } from 'ts-pattern';
import { Imported } from '../../helpers/constants.ts';
import { enumerateSyncedItems } from '../../helpers/programUtil.ts';
import { useIsDarkMode } from '../../hooks/useTunarrTheme.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addSelectedMedia,
  clearSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import type { Maybe } from '../../types/util.ts';
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
  const { t } = useLingui();
  const [selectedServer, selectedLibrary] = useCurrentMediaSourceAndView();
  const currentGenre = useStore((s) => s.currentMediaGenre);
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
  const currentSearchRequest = useStore((s) => s.currentSearchRequest);

  const selectAllItems = useCallback(() => {
    if (!isNil(selectedServer)) {
      removeAllItems();
      setSelectAllLoading(true);
      let prom: Maybe<Promise<void>>;

      if (
        selectedLibrary?.type === Imported ||
        selectedServer.type === 'local'
      ) {
        prom = enumerateSyncedItems(
          selectedServer.id,
          selectedLibrary?.type === Imported ? selectedLibrary.view.id : null,
          currentSearchRequest,
        ).then((res) => {
          const selectedMedia = res.map((program) =>
            match(program)
              .returnType<SelectedMedia>()
              .with({ sourceType: 'local' }, () => ({
                type: 'local',
                id: program.uuid,
                mediaSource: selectedServer,
              }))
              .with({ sourceType: P._ }, (other) => ({
                type: other.sourceType,
                id: program.uuid,
                mediaSource: selectedServer,
                libraryId:
                  selectedLibrary?.type === Imported
                    ? selectedLibrary?.view.id
                    : '',
              }))
              .exhaustive(),
          );
          addSelectedMedia(selectedMedia);
          addKnownMediaForServer(selectedServer.id, res);
        });
      }

      if (!prom) {
        console.error('Could not determine how to selected all items.');
        return;
      }

      prom
        .catch((e) => {
          console.error('Error while attempting to select all items', e);
          snackbar.enqueueSnackbar(
            t`Error querying Plex. Check console log and consider reporting a bug!`,
            {
              variant: 'error',
            },
          );
        })
        .finally(() => setSelectAllLoading(false));
    }
  }, [
    selectedServer,
    selectedLibrary,
    removeAllItems,
    currentSearchRequest,
    currentGenre,
    snackbar,
  ]);

  const darkMode = useIsDarkMode();

  return (
    <Stack
      direction={{ sm: 'column', md: 'row' }}
      spacing={{ sm: 1, md: 4 }}
      sx={{
        width: 'calc(100% + 2em)',
        alignSelf: 'center',
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
        <Plural
          value={selectedMedia.length}
          one="# Selected Item"
          other="# Selected Items"
        />

        {selectedMedia.length > 0 && (
          <Link
            onClick={() => removeAllItems()}
            sx={{ ml: 1, cursor: 'pointer', mr: 4 }}
          >
            <Trans>Clear</Trans>
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
              t`Select All`
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
              {smallViewport ? t`Review` : t`Review Selections`}
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
              {smallViewport ? t`Add Media` : t`Add Selected Media`}
            </Button>
          </>
        )}
      </Box>
    </Stack>
  );
}
