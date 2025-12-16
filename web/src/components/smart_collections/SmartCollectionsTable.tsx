import { Delete, Edit, Search, Visibility } from '@mui/icons-material';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { SmartCollection } from '@tunarr/types';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useState } from 'react';
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
import { EditSmartCollectionDialog } from './EditSmartCollectionDialog.tsx';

export const SmartCollectionsTable = () => {
  const navigate = Route.useNavigate();
  const smartColletionsQuery = useSmartCollections();

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

  const table = useMaterialReactTable({
    data: smartColletionsQuery.data,
    columns: [
      {
        header: 'Name',
        accessorKey: 'name',
        grow: true,
      },
    ],
    renderEmptyRowsFallback() {
      return (
        <Typography
          sx={{ py: '2rem', textAlign: 'center', fontStyle: 'italic' }}
        >
          You have no smart collections. Smart collections can be created on the{' '}
          <RouterLink to="/search">search</RouterLink> page.
        </Typography>
      );
    },
    layoutMode: 'grid',
    enableRowActions: true,
    positionActionsColumn: 'last',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 148, // 3 icons + 16px padding
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    renderTopToolbarCustomActions() {
      return (
        <Stack direction="row" alignItems="center" gap={2} useFlexGap>
          <RouterButtonLink
            variant="contained"
            to="/search"
            search={(prev: RootSearchQueryParams) => ({
              ...prev,
              query: undefined,
            })}
            startIcon={<Search />}
          >
            Create
          </RouterButtonLink>
        </Stack>
      );
    },
    renderRowActions: ({ row }) => {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="View Collection" placement="top">
            <IconButton
              onClick={() =>
                navigate({
                  to: '/library/smart_collections/$id',
                  params: { id: row.original.uuid },
                })
              }
            >
              <Visibility />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit" placement="top">
            <IconButton
              onClick={() => setEditingSmartCollection(row.original.uuid)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton
              onClick={() => setDeletingSmartCollection(row.original)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <EditSmartCollectionDialog
        open={isNonEmptyString(editingSmartCollection)}
        onClose={() => setEditingSmartCollection(undefined)}
        id={editingSmartCollection ?? ''}
      />
      <DeleteConfirmationDialog
        open={!!deletingSmartCollection}
        onClose={() => setDeletingSmartCollection(undefined)}
        onConfirm={() =>
          handleDeleteSmartCollection(deletingSmartCollection!.uuid)
        }
        title={`Delete "${deletingSmartCollection?.name}"`}
        body={`Are you sure you want to delete Smart Collection "${deletingSmartCollection?.name}"?`}
      />
    </>
  );
};
