import jellyfinSvg from '@/assets/jellyfin.svg';
import plexSvg from '@/assets/plex.svg';
import { useMediaSources } from '@/hooks/settingsHooks.ts';
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
import { RouterIconButtonLink } from '../base/RouterButtonLink.tsx';

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

  return (
    <Box sx={sx} {...restProps}>
      <Card raised>
        <CardContent>
          {hasMediaSources ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Edit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mediaSources.map((server) => {
                    return (
                      <TableRow key={server.id}>
                        <TableCell sx={{ maxWidth: 25 }}>
                          <img
                            src={server.type === 'plex' ? plexSvg : jellyfinSvg}
                            width="25"
                          />
                        </TableCell>
                        <TableCell>{server.name}</TableCell>
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
    </Box>
  );
}
