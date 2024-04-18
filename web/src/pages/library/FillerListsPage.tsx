import AddCircleIcon from '@mui/icons-material/AddCircle';

import { Delete, Edit } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

type DeleteFillerListRequest = { id: string };

export default function FillerListsPage() {
  const apiClient = useTunarrApi();
  // This should always be defined because of the preloader
  const { data: fillerLists } = useFillerLists();
  const queryClient = useQueryClient();

  const deleteFillerList = useMutation({
    mutationFn: ({ id }: DeleteFillerListRequest) =>
      apiClient.deleteFillerList(undefined, { params: { id } }),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['fillers'],
      });
    },
    onError: (e) => console.error(e),
  });

  const getTableRows = () => {
    if (!fillerLists) {
      return null;
    }

    if (fillerLists.length === 0) {
      return (
        <TableRow>
          <TableCell sx={{ py: 3, textAlign: 'center' }} colSpan={3}>
            No Filler Lists!
          </TableCell>
        </TableRow>
      );
    }

    return fillerLists.map((filler) => {
      return (
        <TableRow key={filler.id}>
          <TableCell>{filler.name}</TableCell>
          <TableCell>{filler.contentCount}</TableCell>
          <TableCell width="10%">
            <Tooltip title="Edit" placement="top">
              <IconButton
                color="primary"
                to={`/library/fillers/${filler.id}/edit`}
                component={Link}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete" placement="top">
              <IconButton
                color="error"
                onClick={() => deleteFillerList.mutate({ id: filler.id })}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Box>
      <Breadcrumbs />
      <Box display="flex" mb={2}>
        <Typography flexGrow={1} variant="h4">
          Filler Lists
        </Typography>
        <Button
          component={Link}
          to="/library/fillers/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
        >
          New
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell># Clips</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{getTableRows()}</TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
