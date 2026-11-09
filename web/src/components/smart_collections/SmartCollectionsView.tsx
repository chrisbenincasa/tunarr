import { isNonEmptyString } from '@/helpers/util.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Search, Visibility } from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import type { SmartCollection } from '@tunarr/types';
import { useMemo, useState } from 'react';
import type { RootSearchQueryParams } from '../../routes/__root.tsx';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../base/RouterButtonLink.tsx';
import { DeleteConfirmationDialog } from '../DeleteConfirmationDialog.tsx';
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
import { SmartCollectionCard } from './SmartCollectionCard.tsx';

export type SmartCollectionsViewProps = {
  collections: SmartCollection[];
  onOpenCollection: (collection: SmartCollection) => void;
  onEditCollection: (collection: SmartCollection) => void;

  // Called after the user confirms.
  onDeleteCollection: (collection: SmartCollection) => void;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<SmartCollection>();

const clearSearchQuery = (prev: RootSearchQueryParams) => ({
  ...prev,
  query: undefined,
});

export const SmartCollectionsView = ({
  collections,
  onOpenCollection,
  onEditCollection,
  onDeleteCollection,
  layout,
}: SmartCollectionsViewProps) => {
  const { t } = useLingui();
  const tableState = useStoreBackedTableSettings('SmartCollections');
  const [pendingDelete, setPendingDelete] = useState<SmartCollection | null>(
    null,
  );

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ getValue }) => (
            <Box component="span" sx={{ fontWeight: 600 }}>
              {getValue()}
            </Box>
          ),
        }),
        columnHelper.accessor((c) => c.filterString ?? '', {
          id: 'filterString',
          header: t`Query`,
          enableSorting: false,
          cell: ({ row: { original: c } }) =>
            isNonEmptyString(c.keywords) || isNonEmptyString(c.filterString) ? (
              <>
                {isNonEmptyString(c.keywords) && <>“{c.keywords}” </>}
                {isNonEmptyString(c.filterString) && (
                  <MonoText>{c.filterString}</MonoText>
                )}
              </>
            ) : (
              '—'
            ),
        }),
      ]),
      actionsColumn<SmartCollection>({
        render: ({ original: collection }) => (
          <>
            <Tooltip title={t`View Collection`} placement="top">
              <RouterIconButtonLink
                to="/library/smart_collections/$id"
                params={{ id: collection.uuid }}
                aria-label={t`View Collection`}
              >
                <Visibility />
              </RouterIconButtonLink>
            </Tooltip>
            <Tooltip title={t`Edit`} placement="top">
              <IconButton
                aria-label={t`Edit`}
                onClick={() => onEditCollection(collection)}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Delete`} placement="top">
              <IconButton
                aria-label={t`Delete`}
                onClick={() => setPendingDelete(collection)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        ),
      }),
    ],
    [t, onEditCollection],
  );

  const table = useTunarrTable({
    columns,
    data: collections,
    getRowId: (collection) => collection.uuid,
    ...tableState,
  });

  const collectionCount = collections.length;

  const createButton = (
    <RouterButtonLink
      to="/search"
      search={clearSearchQuery}
      variant="contained"
      startIcon={<Search />}
    >
      <Trans>Create</Trans>
    </RouterButtonLink>
  );

  const empty = (
    <EmptyState
      icon={<Search />}
      title={<Trans>You haven't created any smart collections yet.</Trans>}
      description={
        <Trans>
          A smart collection saves a library search. It picks up new items that
          match as your library grows, but it doesn't change programming already
          on a channel.
        </Trans>
      }
      actions={
        <RouterButtonLink
          to="/search"
          search={clearSearchQuery}
          variant="contained"
        >
          <Trans>Search the Library</Trans>
        </RouterButtonLink>
      }
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Smart Collections</Trans>}
        subtitle={
          <Trans>
            <MonoText>{collectionCount}</MonoText>{' '}
            <Plural
              value={collectionCount}
              one="smart collection"
              other="smart collections"
            />
          </Trans>
        }
        actions={createButton}
      />
      <CollectionView
        aria-label={t`Smart Collections`}
        layout={layout}
        items={collections}
        getItemKey={(collection) => collection.uuid}
        empty={empty}
        minCardWidth={280}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(collection) => (
          <SmartCollectionCard
            collection={collection}
            onEdit={() => onEditCollection(collection)}
            onDelete={() => setPendingDelete(collection)}
          />
        )}
        table={
          <DataTable
            table={table}
            aria-label={t`Smart Collections`}
            emptyFallback={empty}
            getRowProps={(row) => ({
              onClick: () => onOpenCollection(row.original),
            })}
          />
        }
      />
      <DeleteConfirmationDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteCollection(pendingDelete);
          }
        }}
        title={t`Delete "${pendingDelete?.name}"`}
        body={t`Are you sure you want to delete Smart Collection "${pendingDelete?.name}"?`}
      />
    </>
  );
};
