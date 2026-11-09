import { betterHumanize } from '@/helpers/dayjs.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Add, Delete, Edit, Sync, VideoLibrary } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import type { CustomShow } from '@tunarr/types';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../base/RouterButtonLink.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { MonoText } from '../ui/MonoText.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import {
  CollectionView,
  type CollectionLayout,
} from '../ui/patterns/CollectionView/index.ts';
import { DataTable } from '../ui/table/DataTable.tsx';
import { actionsColumn } from '../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../ui/table/useStoreBackedTableSettings.ts';
import { CustomShowCard } from './CustomShowCard.tsx';

export type CustomShowsViewProps = {
  shows: CustomShow[];
  onOpenShow: (show: CustomShow) => void;

  // Called after the user confirms.
  onDeleteShow: (show: CustomShow) => void;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<CustomShow>();

export const CustomShowsView = ({
  shows,
  onOpenShow,
  onDeleteShow,
  layout,
}: CustomShowsViewProps) => {
  const { t } = useLingui();
  const tableState = useStoreBackedTableSettings('CustomShows');
  const [pendingDelete, setPendingDelete] = useState<CustomShow | null>(null);

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ row }) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ fontWeight: 600 }}>
                {row.original.name}
              </Box>
              {row.original.syncMediaSourceId && (
                <Tooltip title={t`Synced with external playlist`}>
                  <Sync
                    fontSize="small"
                    color="primary"
                    aria-label={t`Synced with external playlist`}
                  />
                </Tooltip>
              )}
            </Box>
          ),
        }),
        columnHelper.accessor('contentCount', {
          header: t`# Programs`,
          meta: { filterVariant: 'range', numeric: true },
        }),
        columnHelper.accessor('totalDuration', {
          header: t`Duration`,
          enableColumnFilter: false,
          cell: ({ getValue }) =>
            betterHumanize(dayjs.duration(getValue()), { style: 'short' }),
          meta: { numeric: true },
        }),
      ]),
      actionsColumn<CustomShow>({
        render: ({ original: show }) => (
          <>
            <Tooltip title={t`Edit`} placement="top">
              <RouterIconButtonLink
                to="/library/custom-shows/$showId/edit"
                params={{ showId: show.id }}
                aria-label={t`Edit`}
              >
                <Edit />
              </RouterIconButtonLink>
            </Tooltip>
            <Tooltip title={t`Delete`} placement="top">
              <IconButton
                aria-label={t`Delete`}
                onClick={() => setPendingDelete(show)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        ),
      }),
    ],
    [t],
  );

  const table = useTunarrTable({
    columns,
    data: shows,
    getRowId: (show) => show.id,
    ...tableState,
  });

  const showCount = shows.length;

  const empty = (
    <EmptyState
      icon={<VideoLibrary />}
      title={<Trans>You haven't created any playlists yet.</Trans>}
      description={
        <Trans>
          A playlist is an ordered list of videos that channels schedule as if
          they were episodes of one TV show.
        </Trans>
      }
      actions={
        <RouterButtonLink to="/library/custom-shows/new" variant="contained">
          <Trans>Create a Playlist</Trans>
        </RouterButtonLink>
      }
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Playlists</Trans>}
        subtitle={
          <Trans>
            <MonoText>{showCount}</MonoText>{' '}
            <Plural value={showCount} one="playlist" other="playlists" />
          </Trans>
        }
        actions={
          <RouterButtonLink
            to="/library/custom-shows/new"
            variant="contained"
            startIcon={<Add />}
          >
            <Trans>New</Trans>
          </RouterButtonLink>
        }
      />
      <CollectionView
        aria-label={t`Playlists`}
        layout={layout}
        items={shows}
        getItemKey={(show) => show.id}
        empty={empty}
        minCardWidth={260}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(show) => (
          <CustomShowCard show={show} onDelete={() => setPendingDelete(show)} />
        )}
        table={
          <DataTable
            table={table}
            aria-label={t`Playlists`}
            emptyFallback={empty}
            getRowProps={(row) => ({
              onClick: () => onOpenShow(row.original),
            })}
          />
        }
      />
      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        aria-labelledby="delete-custom-show-title"
        aria-describedby="delete-custom-show-description"
      >
        <DialogTitle id="delete-custom-show-title">
          <Trans>Delete Playlist "{pendingDelete?.name}"?</Trans>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-custom-show-description">
            <Trans>
              Deleting a playlist will remove its programming from channels that
              use it. This action cannot be undone.
            </Trans>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} autoFocus>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (pendingDelete) {
                onDeleteShow(pendingDelete);
              }
              setPendingDelete(null);
            }}
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
