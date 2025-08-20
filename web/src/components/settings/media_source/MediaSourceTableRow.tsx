import { CloudDoneOutlined, CloudOff, Delete, Edit } from '@mui/icons-material';
import { IconButton, Link, TableCell, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { MediaSourceSettings } from '@tunarr/types';
import { capitalize, isNull, isUndefined } from 'lodash-es';
import { useState } from 'react';
import { match } from 'ts-pattern';
import { getApiMediaSourcesByIdStatusOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { Emby, Jellyfin, Plex } from '../../../helpers/constants.ts';
import { RotatingLoopIcon } from '../../base/LoadingIcon.tsx';
import { EmbyServerEditDialog } from './EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from './JelllyfinServerEditDialog.tsx';
import { MediaSourceDeleteDialog } from './MediaSourceDeleteDialog.tsx';
import { PlexServerEditDialog } from './PlexServerEditDialog.tsx';

export function MediaSourceTableRow({ server }: MediaSourceTableRowProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const {
    data: backendStatus,
    isLoading: backendStatusLoading,
    error: backendStatusError,
  } = useQuery({
    ...getApiMediaSourcesByIdStatusOptions({ path: { id: server.id } }),
    staleTime: 1000 * 60 * 5,
  });

  const backendHealthy =
    isNull(backendStatusError) &&
    !isUndefined(backendStatus) &&
    backendStatus.healthy;

  const renderEditDialog = () => {
    return match(server)
      .with({ type: Plex }, (plex) => (
        <PlexServerEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          server={plex}
        />
      ))
      .with({ type: Jellyfin }, (jf) => (
        <JellyfinServerEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          server={jf}
        />
      ))
      .with({ type: Emby }, (emby) => (
        <EmbyServerEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          server={emby}
        />
      ))
      .exhaustive();
  };

  return (
    <>
      <TableRow>
        <TableCell>{capitalize(server.type)}</TableCell>
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
      <MediaSourceDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        serverId={server.id}
      />
      {renderEditDialog()}
    </>
  );
}
export type MediaSourceTableRowProps = {
  server: MediaSourceSettings;
};
