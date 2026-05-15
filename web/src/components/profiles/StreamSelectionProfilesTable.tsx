import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import {
  deleteApiStreamSelectionProfilesByIdMutation,
  getApiStreamSelectionProfilesOptions,
  getApiStreamSelectionProfilesQueryKey,
} from '@/generated/@tanstack/react-query.gen';
import type { GetApiStreamSelectionProfilesResponse } from '@/generated/types.gen';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { AddCircle, Delete, Edit } from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
} from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

type Profile = GetApiStreamSelectionProfilesResponse[number];

export const StreamSelectionProfilesTable = () => {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useQuery({
    ...getApiStreamSelectionProfilesOptions(),
  });

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const deleteMutation = useMutation({
    ...deleteApiStreamSelectionProfilesByIdMutation(),
    onSuccess: async () => {
      setConfirmDelete(null);
      await queryClient.invalidateQueries({
        queryKey: getApiStreamSelectionProfilesQueryKey(),
      });
    },
  });

  const renderRowActions = useCallback(
    ({ row: { original: profile } }: { row: MRT_Row<Profile> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title={t`Edit`} placement="top">
            <IconButton
              to={`/profiles/stream-selection/${profile.uuid}`}
              component={Link}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title={t`Delete`} placement="top">
            <IconButton onClick={() => setConfirmDelete(profile)}>
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [],
  );

  const columns = useMemo<MRT_ColumnDef<Profile>[]>(
    () => [
      {
        header: t`Name`,
        accessorKey: 'name',
      },
      {
        header: t`Rules`,
        accessorFn: (row) => row.rules.length,
        size: 100,
      },
      {
        header: t`Used By`,
        size: 200,
        Cell({ row: { original } }) {
          const total =
            original.usedByChannels +
            original.usedByFillers +
            original.usedByPrograms;
          if (total === 0) {
            return (
              <Chip label={t`Not assigned`} size="small" variant="outlined" />
            );
          }
          return (
            <Stack direction="row" spacing={0.5}>
              {original.usedByChannels > 0 && (
                <Chip
                  label={t`${original.usedByChannels} channel(s)`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {original.usedByFillers > 0 && (
                <Chip
                  label={t`${original.usedByFillers} filler(s)`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}
              {original.usedByPrograms > 0 && (
                <Chip
                  label={t`${original.usedByPrograms} program(s)`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
            </Stack>
          );
        },
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    data: profiles,
    columns,
    renderRowActions,
    enableRowActions: true,
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 80,
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    renderTopToolbarCustomActions() {
      return (
        <Stack direction="row" alignItems="center" gap={2} useFlexGap>
          <Button
            variant="contained"
            startIcon={<AddCircle />}
            component={Link}
            to="/profiles/stream-selection/new"
          >
            <Trans>New</Trans>
          </Button>
        </Stack>
      );
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <DeleteConfirmationDialog
        open={confirmDelete !== null}
        title={t`Delete Profile "${confirmDelete?.name ?? ''}"?`}
        body={t`All channels, fillers, and programs using this profile will have their stream selection reset to defaults.`}
        onConfirm={() => {
          if (confirmDelete) {
            deleteMutation.mutate({ path: { id: confirmDelete.uuid } });
          }
        }}
        onClose={() => setConfirmDelete(null)}
        dialogProps={{
          maxWidth: 'sm',
          fullWidth: true,
        }}
      />
    </>
  );
};
