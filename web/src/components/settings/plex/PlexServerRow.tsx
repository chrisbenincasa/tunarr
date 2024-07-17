import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { CloudDoneOutlined, CloudOff, Delete, Edit } from '@mui/icons-material';
import { IconButton, Link, TableCell, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { PlexServerSettings } from '@tunarr/types';
import { isNull, isUndefined } from 'lodash-es';
import { useState } from 'react';
import { RotatingLoopIcon } from '../../base/LoadingIcon.tsx';
import { PlexServerDeleteDialog } from './PlexServerDeleteDialog.tsx';
import { PlexServerEditDialog } from './PlexServerEditDialog.tsx';

export function PlexServerRow({ server }: PlexServerRowProps) {
  const apiClient = useTunarrApi();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const {
    data: backendStatus,
    isLoading: backendStatusLoading,
    error: backendStatusError,
  } = useQuery({
    queryKey: ['plex-servers', server.id, 'status'],
    queryFn: () => apiClient.getPlexServerStatus({ params: { id: server.id } }),
    staleTime: 1000 * 60 * 5,
  });

  const backendHealthy =
    isNull(backendStatusError) &&
    !isUndefined(backendStatus) &&
    backendStatus.healthy;

  return (
    <>
      <TableRow>
        <TableCell width="1%">{server.name}</TableCell>
        <TableCell width="60%">
          <Link href={server.uri} target={'_blank'}>
            {server.uri}
          </Link>
        </TableCell>
        <TableCell align="center">
          {backendStatusLoading ? (
            <RotatingLoopIcon />
          ) : backendHealthy ? (
            <CloudDoneOutlined color="success" />
          ) : (
            <CloudOff color="error" />
          )}
        </TableCell>
        <TableCell width="15%" align="right">
          <>
            <IconButton color="primary" onClick={() => setEditDialogOpen(true)}>
              <Edit />
            </IconButton>
            <IconButton
              color="primary"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Delete />
            </IconButton>
          </>
        </TableCell>
      </TableRow>
      <PlexServerDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        serverId={server.id}
      />
      <PlexServerEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        server={server}
      />
    </>
  );
}
export type PlexServerRowProps = {
  server: PlexServerSettings;
};
