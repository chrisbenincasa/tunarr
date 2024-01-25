import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
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
import { Link } from 'react-router-dom';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { customShowsLoader } from '../channels/loaders.ts';
import { IconButton, Tooltip } from '@mui/material';

export default function CustomShowsPage() {
  const customShows = usePreloadedData(customShowsLoader);

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
          <TableCell width="15%">
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
              <IconButton color="error">
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
              <TableCell width={'80%'}>Name</TableCell>
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
