import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import type { MediaSourceSettings } from '@tunarr/types';
import { capitalize } from 'lodash-es';
import { type ReactNode, useMemo, useState } from 'react';
import { DeleteConfirmationDialog } from '../../DeleteConfirmationDialog.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { MonoText } from '../../ui/MonoText.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import {
  CollectionView,
  type CollectionLayout,
} from '../../ui/patterns/CollectionView/index.ts';
import { DataTable } from '../../ui/table/DataTable.tsx';
import { actionsColumn } from '../../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../ui/table/useStoreBackedTableSettings.ts';
import { MediaSourceCard } from './MediaSourceCard.tsx';
import {
  type MediaSourceHealth,
  MediaSourceHealthPill,
} from './MediaSourceHealthPill.tsx';
import { MediaSourceLibrariesChip } from './MediaSourceLibrariesChip.tsx';
import { MediaSourceLocation } from './MediaSourceLocation.tsx';

export type MediaSourcesViewProps = {
  mediaSources: MediaSourceSettings[];

  // Keyed by source id. A missing entry shows as still checking.
  health: Record<string, MediaSourceHealth>;

  // Opens the add menu. It shows in the header and in the empty state.
  addButton: ReactNode;
  onOpenSource: (source: MediaSourceSettings) => void;
  onEditSource: (source: MediaSourceSettings) => void;
  onRefreshLibraries: (source: MediaSourceSettings) => void;
  onEditLibraries: (source: MediaSourceSettings) => void;

  // Called after the user confirms.
  onDeleteSource: (source: MediaSourceSettings) => void;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<MediaSourceSettings>();

export const MediaSourcesView = ({
  mediaSources,
  health,
  addButton,
  onOpenSource,
  onEditSource,
  onRefreshLibraries,
  onEditLibraries,
  onDeleteSource,
  layout,
}: MediaSourcesViewProps) => {
  const { t } = useLingui();
  const tableState = useStoreBackedTableSettings('MediaSourceSettings');
  const [pendingDelete, setPendingDelete] =
    useState<MediaSourceSettings | null>(null);

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor(({ type }) => capitalize(type), {
          id: 'type',
          header: t`Type`,
          enableSorting: false,
        }),
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ getValue }) => (
            <Box component="span" sx={{ fontWeight: 600 }}>
              {getValue()}
            </Box>
          ),
        }),
        columnHelper.accessor(
          (source) => (source.type === 'local' ? source.paths[0] : source.uri),
          {
            id: 'location',
            header: t`Location`,
            cell: ({ row }) => <MediaSourceLocation source={row.original} />,
          },
        ),
        columnHelper.display({
          id: 'libraries',
          header: t`Libraries`,
          cell: ({ row }) => (
            <MediaSourceLibrariesChip
              mediaSource={row.original}
              onClick={() => onEditLibraries(row.original)}
            />
          ),
        }),
        columnHelper.display({
          id: 'health',
          header: t`Health`,
          cell: ({ row }) => (
            <MediaSourceHealthPill
              health={health[row.original.id] ?? 'checking'}
            />
          ),
        }),
      ]),
      actionsColumn<MediaSourceSettings>({
        render: ({ original: source }) => (
          <>
            <Tooltip title={t`Edit Media Source`} placement="top">
              <IconButton
                aria-label={t`Edit Media Source`}
                onClick={() => onEditSource(source)}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            {source.type !== 'local' && (
              <>
                <Tooltip title={t`Refresh Libraries`} placement="top">
                  <IconButton
                    aria-label={t`Refresh Libraries`}
                    onClick={() => onRefreshLibraries(source)}
                  >
                    <Refresh />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t`Edit Libraries`} placement="top">
                  <IconButton
                    aria-label={t`Edit Libraries`}
                    onClick={() => onEditLibraries(source)}
                  >
                    <VideoLibrary />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title={t`Delete`} placement="top">
              <IconButton
                aria-label={t`Delete`}
                onClick={() => setPendingDelete(source)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        ),
      }),
    ],
    [t, health, onEditSource, onRefreshLibraries, onEditLibraries],
  );

  const table = useTunarrTable({
    columns,
    data: mediaSources,
    getRowId: (source) => source.id,
    ...tableState,
  });

  const sourceCount = mediaSources.length;

  const empty = (
    <EmptyState
      icon={<VideoLibrary />}
      title={<Trans>You haven't added any media sources yet.</Trans>}
      description={
        <Trans>
          Media Sources are where Tunarr sources your content. Media can come
          from your filesystem or a remote server, like Plex or Jellyfin. At
          least one Media Source is necessary to create channels and play media
          in Tunarr.
        </Trans>
      }
      actions={addButton}
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Media Sources</Trans>}
        subtitle={
          <Trans>
            <MonoText>{sourceCount}</MonoText>{' '}
            <Plural
              value={sourceCount}
              one="media source"
              other="media sources"
            />
          </Trans>
        }
        actions={addButton}
      />
      <CollectionView
        aria-label={t`Media Sources`}
        layout={layout}
        items={mediaSources}
        getItemKey={(source) => source.id}
        empty={empty}
        minCardWidth={300}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(source) => (
          <MediaSourceCard
            source={source}
            health={health[source.id] ?? 'checking'}
            onEdit={() => onEditSource(source)}
            onRefreshLibraries={() => onRefreshLibraries(source)}
            onEditLibraries={() => onEditLibraries(source)}
            onDelete={() => setPendingDelete(source)}
          />
        )}
        table={
          <DataTable
            table={table}
            aria-label={t`Media Sources`}
            emptyFallback={empty}
            getRowProps={(row) => ({
              onClick: () => onOpenSource(row.original),
            })}
          />
        }
      />
      <DeleteConfirmationDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteSource(pendingDelete);
          }
        }}
        title={t`Delete Media Source "${pendingDelete?.name}"?`}
        body={t`Deleting a media source will remove all of its associated programs from Tunarr.`}
      />
    </>
  );
};
