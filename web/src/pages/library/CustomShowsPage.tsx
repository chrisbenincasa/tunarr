import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
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
import { Link } from '@tanstack/react-router';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

export default function CustomShowsPage() {
  const apiClient = useTunarrApi();
  const { data: customShows } = useCustomShows();
  const queryClient = useQueryClient();

  const deleteShowMutation = useMutation({
    mutationFn: async (id: string) =>
      apiClient.deleteCustomShow(undefined, { params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['custom-shows'],
        exact: false,
      });
    },
  });

  const getTableRows = () => {
    if (customShows.length === 0) {
      return (
        <TableRow>
          <TableCell sx={{ py: 3, textAlign: 'center' }} colSpan={3}>
            No Custom Shows!
          </TableCell>
        </TableRow>
      );
    }
    return customShows.map((cs) => {
      return (
        <TableRow key={cs.id}>
          <TableCell>{cs.name}</TableCell>
          <TableCell>{cs.contentCount}</TableCell>
          <TableCell width="10%">
            <Tooltip title="Edit" placement="top">
              <IconButton
                color="primary"
                to={`/library/custom-shows/${cs.id}/edit`}
                component={Link}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete" placement="top">
              <IconButton
                color="error"
                onClick={() => deleteShowMutation.mutate(cs.id)}
              >
                <DeleteIcon />
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
          Custom Shows
        </Typography>
        <Button
          component={Link}
          to="/library/custom-shows/new"
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
              <TableCell width={'75%'}>Name</TableCell>
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
