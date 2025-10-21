import { Delete, Edit, Search } from '@mui/icons-material';
import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink } from '@tanstack/react-router';
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
import { Route } from '../../routes/__root.tsx';
import type { Maybe } from '../../types/util.ts';
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
          <Link component={RouterLink} to="/search">
            search
          </Link>{' '}
          page.
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
    renderRowActions: ({ row }) => {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Search" placement="top">
            <IconButton
              onClick={() =>
                navigate({
                  to: '/search',
                  search: { query: row.original.query },
                })
              }
            >
              <Search />
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
      />
    </>
  );
};
