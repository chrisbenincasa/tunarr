import { Trans } from '@lingui/react/macro';
import { useMediaSources } from '@/hooks/settingsHooks.ts';
import type { Nullable } from '@/types/util.ts';
import { Edit } from '@mui/icons-material';
import type { CardProps } from '@mui/material';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { MediaSourceSettings } from '@tunarr/types';
import { useState } from 'react';
import { RouterIconButtonLink } from '../base/RouterButtonLink.tsx';
import { NetworkIcon } from '../util/NetworkIcon.tsx';
import { EditMediaSourceLibrariesDialog } from './media_source/EditMediaSourceLibrariesDialog.tsx';
import { MediaSourceLibrariesChip } from './media_source/MediaSourceLibrariesChip.tsx';

export default function ConnectMediaSources(props: CardProps) {
  const {
    sx = {
      py: 2,
      margin: '0 auto',
      textAlign: 'center',
    },
    ...restProps
  } = props;

  const { data: mediaSources } = useMediaSources();
  const hasMediaSources = mediaSources && mediaSources.length > 0;
  const [editingLibraries, setEditingLibraries] =
    useState<Nullable<MediaSourceSettings>>(null);

  return (
    <Box sx={sx} {...restProps}>
      <Card>
        <CardContent>
          {hasMediaSources ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>
                      <Trans>Name</Trans>
                    </TableCell>
                    <TableCell>
                      <Trans>Libraries</Trans>
                    </TableCell>
                    <TableCell>
                      <Trans>Edit</Trans>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mediaSources.map((server) => {
                    return (
                      <TableRow key={server.id}>
                        <TableCell sx={{ maxWidth: 25 }}>
                          <NetworkIcon network={server.type} width={25} />
                        </TableCell>
                        <TableCell>{server.name}</TableCell>
                        <TableCell>
                          <MediaSourceLibrariesChip
                            mediaSource={server}
                            onClick={() => setEditingLibraries(server)}
                          />
                        </TableCell>
                        <TableCell>
                          <RouterIconButtonLink
                            to={`/settings/sources`}
                            color="primary"
                          >
                            <Edit />
                          </RouterIconButtonLink>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </CardContent>
      </Card>
      <EditMediaSourceLibrariesDialog
        open={editingLibraries !== null}
        mediaSource={editingLibraries}
        onClose={() => setEditingLibraries(null)}
      />
    </Box>
  );
}
