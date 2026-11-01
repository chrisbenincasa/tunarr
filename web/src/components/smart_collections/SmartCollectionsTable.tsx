import { Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Search, Visibility } from '@mui/icons-material';
import { Dialog, IconButton, Tooltip, Typography } from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { SmartCollection } from '@tunarr/types';
import { useCallback, useMemo, useState } from 'react';
import {
  useDeleteSmartCollection,
  useSmartCollections,
} from '../../hooks/smartCollectionHooks.ts';
import type { RootSearchQueryParams } from '../../routes/__root.tsx';
import { Route } from '../../routes/__root.tsx';
import type { Maybe } from '../../types/util.ts';
import { RouterButtonLink } from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { DeleteConfirmationDialog } from '../DeleteConfirmationDialog.tsx';
import { DataTable } from '../ui/table/DataTable.tsx';
import { actionsColumn } from '../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../ui/table/useStoreBackedTableSettings.ts';
import { EditSmartCollectionDialog } from './EditSmartCollectionDialog.tsx';

const columnHelper = createAppColumnHelper<SmartCollection>();

export const SmartCollectionsTable = () => {
  const { t } = useLingui();
  const navigate = Route.useNavigate();
  const smartColletionsQuery = useSmartCollections();
  const tableSettings = useStoreBackedTableSettings('SmartCollections');

  const [editingSmartCollection, setEditingSmartCollection] =
    useState<Maybe<string>>();
  const [deletingSmartCollection, setDeletingSmartCollection] =
    useState<Maybe<SmartCollection>>();

  const deleteSmartCollectionMut = useDeleteSmartCollection();

  const handleDeleteSmartCollection = useCallback(
    (id: string) => {
      deleteSmartCollectionMut.mutate({
        path: {
          id,
        },
      });
    },
    [deleteSmartCollectionMut],
  );

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', { header: t`Name` }),
      ]),
      actionsColumn<SmartCollection>({
        render: ({ original: collection }) => (
          <>
            <Tooltip title={t`View Collection`} placement="top">
              <IconButton
                aria-label={t`View Collection`}
                onClick={() =>
                  navigate({
                    to: '/library/smart_collections/$id',
                    params: { id: collection.uuid },
                  })
                }
              >
                <Visibility />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Edit`} placement="top">
              <IconButton
                aria-label={t`Edit`}
                onClick={() => setEditingSmartCollection(collection.uuid)}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Delete`} placement="top">
              <IconButton
                aria-label={t`Delete`}
                onClick={() => setDeletingSmartCollection(collection)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        ),
      }),
    ],
    [navigate, t],
  );

  const table = useTunarrTable({
    columns,
    data: smartColletionsQuery.data,
    ...tableSettings,
  });

  return (
    <>
      <DataTable
        table={table}
        aria-label={t`Smart Collections`}
        toolbarActions={
          <RouterButtonLink
            variant="contained"
            to="/search"
            search={(prev: RootSearchQueryParams) => ({
              ...prev,
              query: undefined,
            })}
            startIcon={<Search />}
          >
            <Trans>Create</Trans>
          </RouterButtonLink>
        }
        emptyFallback={
          <Typography sx={{ py: 4, textAlign: 'center', fontStyle: 'italic' }}>
            <Trans>
              You have no smart collections. Smart collections can be created on
              the <RouterLink to="/search">search</RouterLink> page.
            </Trans>
          </Typography>
        }
      />
      <Dialog
        open={isNonEmptyString(editingSmartCollection)}
        onClose={() => setEditingSmartCollection(undefined)}
        fullWidth
      >
        <EditSmartCollectionDialog
          onClose={() => setEditingSmartCollection(undefined)}
          id={editingSmartCollection ?? ''}
        />
      </Dialog>
      <DeleteConfirmationDialog
        open={!!deletingSmartCollection}
        onClose={() => setDeletingSmartCollection(undefined)}
        onConfirm={() => {
          if (deletingSmartCollection) {
            handleDeleteSmartCollection(deletingSmartCollection.uuid);
          }
        }}
        title={t`Delete "${deletingSmartCollection?.name}"`}
        body={t`Are you sure you want to delete Smart Collection "${deletingSmartCollection?.name}"?`}
      />
    </>
  );
};
