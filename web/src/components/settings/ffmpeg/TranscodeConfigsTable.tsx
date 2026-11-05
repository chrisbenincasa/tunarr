import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { AddCircle, ContentCopy, Delete, Edit } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { TranscodeConfig } from '@tunarr/types';
import { isNull } from 'lodash-es';
import { useMemo, useState } from 'react';
import {
  deleteApiTranscodeConfigsByIdMutation,
  getApiTranscodeConfigsQueryKey,
  postApiTranscodeConfigsByIdCopyMutation,
} from '../../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../../helpers/queryUtil.ts';
import { useTranscodeConfigs } from '../../../hooks/settingsHooks.ts';
import { DeleteConfirmationDialog } from '../../DeleteConfirmationDialog.tsx';
import { DataTable } from '../../ui/table/DataTable.tsx';
import { actionsColumn } from '../../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../ui/table/useStoreBackedTableSettings.ts';

const columnHelper = createAppColumnHelper<TranscodeConfig>();

const hardwareAccelLabel = (
  value: TranscodeConfig['hardwareAccelerationMode'],
) => {
  switch (value) {
    case 'none':
      return t`Software (No GPU)`;
    case 'cuda':
      return 'CUDA';
    case 'vaapi':
      return 'VA-API';
    case 'qsv':
      return 'QuickSync';
    case 'videotoolbox':
      return 'VideoToolbox';
  }
};

export const TranscodeConfigsTable = () => {
  const queryClient = useQueryClient();
  const transcodeConfigs = useTranscodeConfigs();
  const tableSettings = useStoreBackedTableSettings('TranscodeConfigs');

  const [confirmDeleteTranscodeConfig, setConfirmDeleteTranscodeConfig] =
    useState<TranscodeConfig | null>(null);

  const { mutate: duplicateConfig } = useMutation({
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

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ getValue, row: { original: config } }) => {
            if (config.isDefault) {
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={t`Default Config`} placement="top">
                    <CheckCircleOutlineIcon />
                  </Tooltip>
                  {getValue()}
                </Box>
              );
            }
            return getValue();
          },
        }),
        columnHelper.accessor(
          (config) =>
            `${config.resolution.widthPx}x${config.resolution.heightPx}`,
          {
            // MRT named this column after its header, and saved column
            // visibility is keyed by that id.
            id: t`Resolution`,
            header: t`Resolution`,
          },
        ),
        columnHelper.accessor('hardwareAccelerationMode', {
          header: t`Hardware Accel.`,
          cell: ({ getValue }) => hardwareAccelLabel(getValue()),
        }),
        columnHelper.accessor('videoFormat', { header: t`Video Format` }),
        columnHelper.accessor('audioFormat', { header: t`Audio Format` }),
      ]),
      actionsColumn<TranscodeConfig>({
        render: ({ original: config }) => (
          <>
            <Tooltip title={t`Edit`} placement="top">
              <IconButton
                aria-label={t`Edit`}
                to={`/settings/ffmpeg/${config.id}`}
                component={Link}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Duplicate`} placement="top">
              <IconButton
                aria-label={t`Duplicate`}
                onClick={() => duplicateConfig({ path: { id: config.id } })}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Delete`} placement="top">
              <IconButton
                aria-label={t`Delete`}
                onClick={() => setConfirmDeleteTranscodeConfig(config)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        ),
      }),
    ],
    [duplicateConfig],
  );

  const table = useTunarrTable({
    columns,
    data: transcodeConfigs.data,
    ...tableSettings,
  });

  return (
    <>
      <DataTable
        table={table}
        aria-label={t`Transcoding Configs`}
        toolbarActions={
          <Button
            variant="contained"
            startIcon={<AddCircle />}
            component={Link}
            to="/settings/ffmpeg/new"
          >
            <Trans>New</Trans>
          </Button>
        }
      />
      <DeleteConfirmationDialog
        open={!isNull(confirmDeleteTranscodeConfig)}
        title={t`Delete Transcoding Config "${confirmDeleteTranscodeConfig?.name ?? ''}"?`}
        body={t`All channels assigned to this config will be set to use the default configuration. If this is the last configuration, a new default configuration will be created.`}
        onConfirm={() => {
          if (confirmDeleteTranscodeConfig) {
            deleteTranscodeConfig.mutate({
              path: { id: confirmDeleteTranscodeConfig.id },
            });
          }
        }}
        onClose={() => setConfirmDeleteTranscodeConfig(null)}
        dialogProps={{
          maxWidth: 'sm',
          fullWidth: true,
        }}
      />
    </>
  );
};
