import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  Add,
  Delete,
  Edit,
  PlaylistAdd,
  QueueMusic,
} from '@mui/icons-material';
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
import type { FillerList } from '@tunarr/types';
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
import { FillerListCard } from './FillerListCard.tsx';

export type FillerListsViewProps = {
  fillers: FillerList[];
  onOpenFiller: (filler: FillerList) => void;
  onAssignChannels: (filler: FillerList) => void;

  // Called after the user confirms.
  onDeleteFiller: (filler: FillerList) => void;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<FillerList>();

export const FillerListsView = ({
  fillers,
  onOpenFiller,
  onAssignChannels,
  onDeleteFiller,
  layout,
}: FillerListsViewProps) => {
  const { t } = useLingui();
  const tableState = useStoreBackedTableSettings('FillerLists');
  const [pendingDelete, setPendingDelete] = useState<FillerList | null>(null);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ getValue }) => (
            <Box component="span" sx={{ fontWeight: 600 }}>
              {getValue()}
            </Box>
          ),
        }),
        columnHelper.accessor('contentCount', {
          header: t`# Programs`,
          meta: { filterVariant: 'range', numeric: true },
        }),
        actionsColumn<FillerList>({
          render: ({ original: filler }) => (
            <>
              <Tooltip title={t`Assign to Channels`} placement="top">
                <IconButton
                  aria-label={t`Assign to Channels`}
                  onClick={() => onAssignChannels(filler)}
                >
                  <PlaylistAdd />
                </IconButton>
              </Tooltip>
              <Tooltip title={t`Edit`} placement="top">
                <RouterIconButtonLink
                  to="/library/fillers/$fillerId/edit"
                  params={{ fillerId: filler.id }}
                  aria-label={t`Edit`}
                >
                  <Edit />
                </RouterIconButtonLink>
              </Tooltip>
              <Tooltip title={t`Delete`} placement="top">
                <IconButton
                  aria-label={t`Delete`}
                  onClick={() => setPendingDelete(filler)}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </>
          ),
        }),
      ]),
    [t, onAssignChannels],
  );

  const table = useTunarrTable({
    columns,
    data: fillers,
    getRowId: (filler) => filler.id,
    ...tableState,
  });

  const fillerCount = fillers.length;

  const empty = (
    <EmptyState
      icon={<QueueMusic />}
      title={<Trans>You haven't created any filler lists yet.</Trans>}
      description={
        <Trans>
          A filler list holds videos that play during flex time, the parts of a
          channel with no program scheduled.
        </Trans>
      }
      actions={
        <RouterButtonLink to="/library/fillers/new" variant="contained">
          <Trans>Create a Filler List</Trans>
        </RouterButtonLink>
      }
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Filler Lists</Trans>}
        subtitle={
          <Trans>
            <MonoText>{fillerCount}</MonoText>{' '}
            <Plural
              value={fillerCount}
              one="filler list"
              other="filler lists"
            />
          </Trans>
        }
        actions={
          <RouterButtonLink
            to="/library/fillers/new"
            variant="contained"
            startIcon={<Add />}
          >
            <Trans>New</Trans>
          </RouterButtonLink>
        }
      />
      <CollectionView
        aria-label={t`Filler Lists`}
        layout={layout}
        items={fillers}
        getItemKey={(filler) => filler.id}
        empty={empty}
        minCardWidth={280}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(filler) => (
          <FillerListCard
            filler={filler}
            onAssignChannels={() => onAssignChannels(filler)}
            onDelete={() => setPendingDelete(filler)}
          />
        )}
        table={
          <DataTable
            table={table}
            aria-label={t`Filler Lists`}
            emptyFallback={empty}
            getRowProps={(row) => ({
              onClick: () => onOpenFiller(row.original),
            })}
          />
        }
      />
      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        aria-labelledby="delete-filler-list-title"
        aria-describedby="delete-filler-list-description"
      >
        <DialogTitle id="delete-filler-list-title">
          <Trans>Delete Filler List "{pendingDelete?.name}"?</Trans>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-filler-list-description">
            <Trans>
              Deleting a Filler will remove all programming from the channel.
              This action cannot be undone.
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
                onDeleteFiller(pendingDelete);
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
