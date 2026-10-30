import AddCircleIcon from '@mui/icons-material/AddCircle';

import { isNonEmptyString } from '@/helpers/util.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, PlaylistAdd } from '@mui/icons-material';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  Tooltip,
} from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { type FillerList } from '@tunarr/types';
import { find } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { AssignFillerToChannelsDialog } from '../../components/fillers/AssignFillerToChannelsDialog.tsx';
import {
  deleteApiFillerListsByIdMutation,
  getApiFillerListsQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import { DataTable } from '../../components/ui/table/DataTable.tsx';
import { actionsColumn } from '../../components/ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../components/ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../components/ui/table/useStoreBackedTableSettings.ts';

const columnHelper = createAppColumnHelper<FillerList>();

const TableName = 'FillerLists';

export default function FillerListsPage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<
    string | undefined
  >(undefined);
  const [assignFiller, setAssignFiller] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const snackbar = useSnackbar();

  const tableState = useStoreBackedTableSettings(TableName);

  const deleteFillerList = useMutation({
    ...deleteApiFillerListsByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getApiFillerListsQueryKey(),
        exact: false,
      });
    },
    onError: (e) => {
      snackbar.enqueueSnackbar({
        message: (
          <Trans>
            <span>
              Error deleting filler list: {e.message}
              <br />
              Please consider opening a bug with details!
            </span>
          </Trans>
        ),
        variant: 'error',
      });
      console.error(e);
    },
    onSettled: () => {
      setDeleteConfirmationId(undefined);
    },
  });

  const { data: fillerLists } = useFillerLists();
  const navigate = useNavigate();

  const handleFillerNavigation = (id: string) => {
    navigate({
      to: `/library/fillers/$fillerId/edit`,
      params: { fillerId: id },
    }).catch(console.error);
  };

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={isNonEmptyString(deleteConfirmationId)}
        onClose={() => setDeleteConfirmationId(undefined)}
        aria-labelledby="delete-filler-list-title"
        aria-describedby="delete-filler-list-description"
      >
        <DialogTitle id="delete-filler-list-title">
          <Trans>
            Delete Filler List "
            {find(fillerLists, { id: deleteConfirmationId })?.name}"?
          </Trans>
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
          <Button onClick={() => setDeleteConfirmationId(undefined)} autoFocus>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            onClick={() => {
              if (deleteConfirmationId !== undefined) {
                deleteFillerList.mutate({ path: { id: deleteConfirmationId } });
              }
            }}
            variant="contained"
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', { header: t`Name` }),
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
                  onClick={() =>
                    setAssignFiller({ id: filler.id, name: filler.name })
                  }
                >
                  <PlaylistAdd />
                </IconButton>
              </Tooltip>
              <Tooltip title={t`Edit`} placement="top">
                <IconButton
                  aria-label={t`Edit`}
                  to={`/library/fillers/${filler.id}/edit`}
                  component={RouterLink}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
              <Tooltip title={t`Delete`} placement="top">
                <IconButton
                  aria-label={t`Delete`}
                  onClick={() => setDeleteConfirmationId(filler.id)}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </>
          ),
        }),
      ]),
    [t],
  );

  const table = useTunarrTable({
    columns,
    data: fillerLists,
    ...tableState,
  });

  return (
    <Box>
      <Breadcrumbs />
      {renderConfirmationDialog()}
      {assignFiller !== undefined && (
        <AssignFillerToChannelsDialog
          open
          onClose={() => setAssignFiller(undefined)}
          fillerId={assignFiller.id}
          fillerName={assignFiller.name}
        />
      )}
      <Box display="flex" mb={2} alignItems="flex-start">
        <Box flexDirection={'column'} flexGrow={1}>
          <Typography flexGrow={1} variant="h4">
            <Trans>Filler Lists</Trans>
          </Typography>
          <Typography maxWidth={'800px'}>
            <Trans>
              Filler lists are collections of videos that you may want to play
              during 'flex' time segments. Flex is time within a channel that
              does not have a program scheduled (usually used for padding).
            </Trans>
          </Typography>
        </Box>

        <Button
          component={RouterLink}
          to="/library/fillers/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
          sx={{ alignSelf: 'end' }}
        >
          <Trans>New</Trans>
        </Button>
      </Box>

      <DataTable
        table={table}
        aria-label={t`Filler Lists`}
        getRowProps={(row) => ({
          onClick: () => handleFillerNavigation(row.original.id),
        })}
        emptyFallback={
          <Typography sx={{ py: 4, textAlign: 'center', fontStyle: 'italic' }}>
            <Trans>
              You have no Filler Lists. Create your first Filler List{' '}
              <Link component={RouterLink} to="/library/fillers/new">
                here.
              </Link>
            </Trans>
          </Typography>
        }
      />
    </Box>
  );
}
