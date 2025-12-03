import { isNonEmptyString } from '@/helpers/util.ts';
import { useIsDarkMode } from '@/hooks/useTunarrTheme.ts';
import { useSettings } from '@/store/settings/selectors.ts';
import { Close, MoreVert, Refresh } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProgramLike, TupleToUnion } from '@tunarr/types';
import { isStructuralItemType, isTerminalItemType } from '@tunarr/types';
import type { Dayjs } from 'dayjs';
import { find, isEqual, merge } from 'lodash-es';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { DeepRequired } from 'ts-essentials';
import {
  getApiProgramGroupingsByIdOptions,
  getApiProgramGroupingsByIdQueryKey,
  getApiProgramsByIdOptions,
  postApiMoviesByIdScanMutation,
  postApiShowsByIdScanMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import type { Nullable } from '../../types/util.ts';
import { ProgramMetadataDialogContent } from '../ProgramMetadataDialogContent.tsx';
import { ProgramStreamDetails } from '../ProgramStreamDetails.tsx';
import { RawProgramDetails } from '../RawProgramDetails.tsx';
import { TabPanel } from '../TabPanel.tsx';

const Panels = ['metadata', 'stream_details', 'program_details'] as const;
type Panels = TupleToUnion<typeof Panels>;
type PanelVisibility = {
  [K in Panels]?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  programId: string;
  start?: Dayjs;
  stop?: Dayjs;
  programType: ProgramLike['type'];
  panelVisibility?: PanelVisibility;
};

const DefaultPanelVisibility: DeepRequired<PanelVisibility> = {
  metadata: true,
  stream_details: true,
  program_details: true,
};

export default function ProgramDetailsDialog({
  onClose,
  open,
  start,
  stop,
  programId,
  programType,
  panelVisibility = DefaultPanelVisibility,
}: Props) {
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const darkMode = useIsDarkMode();
  const [moreMenuAnchorEl, setMoreMenuAnchorEl] =
    useState<Nullable<HTMLElement>>(null);
  const moreMenuOpen = !!moreMenuAnchorEl;

  const visibility = useMemo(
    () => merge(DefaultPanelVisibility, panelVisibility),
    [panelVisibility],
  );

  const defaultPanel = (find(Object.entries(visibility), (v) => !!v)?.[0] ??
    'metadata') as Panels;
  const [tab, setTab] = useState<Panels>(defaultPanel);

  const query = useQuery({
    ...getApiProgramsByIdOptions({
      path: {
        id: programId,
      },
    }),
    enabled: open && isTerminalItemType(programType),
  });

  const parentQuery = useQuery({
    ...getApiProgramGroupingsByIdOptions({
      path: {
        id: programId,
      },
    }),
    enabled:
      open &&
      !isTerminalItemType(programType) &&
      !isStructuralItemType(programType),
  });

  const programData = query?.data || parentQuery?.data;
  const isLoading = parentQuery.isLoading || query.isLoading;
  const settings = useSettings();
  const backgroundImageUrl = useMemo(() => {
    if (!programData?.uuid) return;

    let artworkId;

    if (programData.type === 'episode' || programData.type === 'season') {
      artworkId = programData?.show?.uuid;
    } else {
      artworkId = programData.uuid;
    }

    return `${settings.backendUri}/api/programs/${artworkId}/artwork/banner`;
  }, [settings.backendUri, programData]);

  const title = useMemo(() => {
    if (!programData?.uuid) return;

    if (programData.type === 'episode' || programData.type === 'season') {
      return programData?.show?.title;
    } else {
      return programData.title;
    }
  }, [programData]);

  const queryClient = useQueryClient();
  const clearQueryCache = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: (key) => {
        return (
          isEqual(
            key,
            getApiProgramGroupingsByIdQueryKey({ path: { id: programId } }),
          ) ||
          isEqual(key, getApiProgramsByIdOptions({ path: { id: programId } }))
        );
      },
    });
  }, [programId, queryClient]);

  const showScanMut = useMutation({
    ...postApiShowsByIdScanMutation(),
    onSuccess: () => {
      return clearQueryCache();
    },
  });

  const movieScanMut = useMutation({
    ...postApiMoviesByIdScanMutation(),
    onSuccess: () => {
      return clearQueryCache();
    },
  });

  const scanItem = useCallback(() => {
    switch (programType) {
      case 'movie': {
        movieScanMut.mutate({ path: { id: programId } }, {});
        break;
      }
      case 'show': {
        showScanMut.mutate({
          path: { id: programId },
        });
        break;
      }
      case 'season':
      case 'episode':
      case 'album':
      case 'artist':
      case 'track':
      case 'music_video':
      case 'other_video':
        break;
    }

    setMoreMenuAnchorEl(null);
  }, [movieScanMut, programId, programType, showScanMut]);

  return (
    <Dialog
      open={open}
      fullScreen={smallViewport}
      maxWidth="md"
      fullWidth
      onClose={() => onClose()}
      slotProps={{
        paper: {
          sx: {
            boxShadow: '0 0 10px 10px rgba(0, 0, 0, 0.25)',
            backgroundImage: darkMode
              ? `linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url("${backgroundImageUrl}")`
              : `linear-gradient(rgba(250, 250, 250, 1), rgba(250, 250, 250, 0.6)), url("${backgroundImageUrl}")`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            minHeight: programType === 'episode' ? 450 : 575,
          },
        },
      }}
    >
      {isLoading ? (
        <Skeleton width={'50%'} sx={{ py: 2, px: 4, ml: 3 }}>
          <DialogTitle
            variant="h4"
            sx={{ display: 'flex', alignItems: 'center' }}
          />
        </Skeleton>
      ) : (
        <DialogTitle
          variant="h4"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Box sx={{ flex: 1 }}>{title}</Box>
          {programType === 'show' || programType === 'movie' ? (
            <IconButton
              onClick={(e) => setMoreMenuAnchorEl(e.currentTarget)}
              sx={{ mr: 1 }}
            >
              <MoreVert />
            </IconButton>
          ) : null}
          <Menu
            anchorEl={moreMenuAnchorEl}
            open={moreMenuOpen}
            onClose={() => setMoreMenuAnchorEl(null)}
          >
            {/* <MenuList>
            </MenuList> */}
            <MenuItem onClick={() => scanItem()}>
              <ListItemIcon>
                <Refresh fontSize="small" />
              </ListItemIcon>
              <ListItemText>Scan</ListItemText>
            </MenuItem>
          </Menu>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => onClose()}
            aria-label="close"
            size="large"
          >
            <Close />
          </IconButton>
        </DialogTitle>
      )}

      <DialogContent>
        {isLoading ? (
          <Skeleton width={'400px'} sx={{ mb: 2 }}>
            <Tabs />
          </Skeleton>
        ) : (
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as Panels)}
            sx={{ mb: 2 }}
          >
            {visibility.metadata && <Tab value={'metadata'} label="Overview" />}

            {visibility.stream_details &&
              query?.data?.uuid &&
              isNonEmptyString(query?.data?.uuid) && (
                <Tab value="stream_details" label="Stream Info" />
              )}

            {visibility.program_details && (
              <Tab value="program_details" label="Program Info" />
            )}
          </Tabs>
        )}

        <TabPanel index={'metadata'} value={tab}>
          {programData && !isLoading ? (
            <ProgramMetadataDialogContent
              program={programData}
              start={start}
              stop={stop}
            />
          ) : (
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={smallViewport ? 0 : 2}
                flexDirection={smallViewport ? 'column' : 'row'}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    textAlign: 'center',
                    flex: smallViewport ? undefined : '0 0 25%',
                  }}
                >
                  <Skeleton
                    variant="rounded"
                    width={
                      programType === 'movie' ||
                      programType === 'show' ||
                      programType === 'season'
                        ? smallViewport
                          ? '55%'
                          : 240
                        : smallViewport
                          ? '55%'
                          : 240
                    }
                    height={
                      programType === 'movie' ||
                      programType === 'show' ||
                      programType === 'season'
                        ? smallViewport
                          ? 282
                          : 360
                        : smallViewport
                          ? undefined
                          : 135
                    }
                    sx={{
                      borderRadius: '10px',
                      alignSelf: 'center',
                    }}
                  ></Skeleton>
                  <Skeleton height="30px"></Skeleton>
                  <Skeleton height="30px"></Skeleton>
                </Box>
                <Box width={'100%'}>
                  <Skeleton width="20%"></Skeleton>
                  <Skeleton></Skeleton>
                  <Skeleton></Skeleton>
                  <Skeleton width={'75%'}></Skeleton>
                </Box>
              </Stack>
            </Stack>
          )}
        </TabPanel>

        <TabPanel index={'stream_details'} value={tab}>
          {visibility.stream_details &&
          query?.data?.uuid &&
          isNonEmptyString(query?.data?.uuid) ? (
            <>
              <ErrorBoundary
                fallback={
                  <>Failed to load stream details! Check logs for details</>
                }
              >
                <Suspense fallback={<LinearProgress />}>
                  <ProgramStreamDetails programId={query?.data?.uuid} />
                </Suspense>
              </ErrorBoundary>
            </>
          ) : null}
        </TabPanel>

        <TabPanel index={'program_details'} value={tab}>
          {visibility.program_details && programData?.uuid ? (
            <ErrorBoundary
              fallback={
                <>Failed to load item details! Check logs for details</>
              }
            >
              <Suspense fallback={<LinearProgress />}>
                <RawProgramDetails program={programData} />
              </Suspense>
            </ErrorBoundary>
          ) : null}
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
}
