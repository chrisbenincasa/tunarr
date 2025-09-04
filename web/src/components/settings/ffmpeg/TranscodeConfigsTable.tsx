import { AddCircle, ContentCopy, Delete, Edit } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Button, IconButton, Stack, Tooltip } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { TranscodeConfig } from '@tunarr/types';
import type { SupportedHardwareAccels } from '@tunarr/types/schemas';
import { isNull } from 'lodash-es';
import type { MRT_ColumnDef, MRT_Row } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import {
  deleteApiTranscodeConfigsByIdMutation,
  getApiTranscodeConfigsQueryKey,
  postApiTranscodeConfigsByIdCopyMutation,
} from '../../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../../helpers/queryUtil.ts';
import { useTranscodeConfigs } from '../../../hooks/settingsHooks.ts';
import { DeleteConfirmationDialog } from '../../DeleteConfirmationDialog.tsx';

export const TranscodeConfigsTable = () => {
  const queryClient = useQueryClient();
  const transcodeConfigs = useTranscodeConfigs();

  const [confirmDeleteTranscodeConfig, setConfirmDeleteTranscodeConfig] =
    useState<TranscodeConfig | null>(null);

  const duplicateConfigMutation = useMutation({
    ...postApiTranscodeConfigsByIdCopyMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        exact: false,
        queryKey: getApiTranscodeConfigsQueryKey(),
      });
    },
  });

  const deleteTranscodeConfig = useMutation({
    ...deleteApiTranscodeConfigsByIdMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Settings'),
      });
    },
  });

  const handleDuplicateConfig = useCallback(
    (id: string) => {
      duplicateConfigMutation.mutate({ path: { id } });
    },
    [duplicateConfigMutation],
  );

  const renderRowActions = useCallback(
    ({ row: { original: config } }: { row: MRT_Row<TranscodeConfig> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title="Edit" placement="top">
            <IconButton to={`/settings/ffmpeg/${config.id}`} component={Link}>
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Duplicate" placement="top">
            <IconButton onClick={() => handleDuplicateConfig(config.id)}>
              <ContentCopy />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton onClick={() => setConfirmDeleteTranscodeConfig(config)}>
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [handleDuplicateConfig],
  );

  const rows = useMemo(() => {
    return transcodeConfigs.data;
  }, [transcodeConfigs.data]);

  const columns = useMemo<MRT_ColumnDef<TranscodeConfig>[]>(() => {
    return [
      {
        header: 'Name',
        accessorKey: 'name',
        Cell({ cell, row: { original: config } }) {
          if (config.isDefault) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Default Config" placement="top">
                  <CheckCircleOutlineIcon />
                </Tooltip>
                {cell.getValue<string>()}
              </Box>
            );
          }
          return cell.getValue<string>();
        },
      },
      {
        header: 'Resolution',
        accessorFn(originalRow) {
          return `${originalRow.resolution.widthPx}x${originalRow.resolution.heightPx}`;
        },
      },
      {
        header: 'Hardware Accel.',
        accessorKey: 'hardwareAccelerationMode',
        Cell({ cell }) {
          const value = cell.getValue<SupportedHardwareAccels>();
          switch (value) {
            case 'none':
              return 'Software (No GPU)';
            case 'cuda':
              return 'CUDA';
            case 'vaapi':
              return 'VA-API';
            case 'qsv':
              return 'QuickSync';
            case 'videotoolbox':
              return 'VideoToolbox';
          }
        },
      },
      {
        header: 'Video Format',
        accessorKey: 'videoFormat',
      },
      {
        header: 'Audio Format',
        accessorKey: 'audioFormat',
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    data: rows,
    columns,
    renderRowActions,
    enableRowActions: true,
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 100,
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    positionActionsColumn: 'last',
    renderTopToolbarCustomActions() {
      return (
        <Stack direction="row" alignItems="center" gap={2} useFlexGap>
          <Button
            variant="contained"
            startIcon={<AddCircle />}
            component={Link}
            to="/settings/ffmpeg/new"
          >
            New
          </Button>
        </Stack>
      );
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <DeleteConfirmationDialog
        open={!isNull(confirmDeleteTranscodeConfig)}
        title={`Delete Transcoding Config "${confirmDeleteTranscodeConfig?.name}"?`}
        body="All channels assigned to this config will be set to use the default configuration. If this is the last configuration, a new default configuration will be created."
        onConfirm={() =>
          deleteTranscodeConfig.mutate({
            path: { id: confirmDeleteTranscodeConfig!.id },
          })
        }
        onClose={() => setConfirmDeleteTranscodeConfig(null)}
        dialogProps={{
          maxWidth: 'sm',
          fullWidth: true,
        }}
      />
    </>
  );
};
