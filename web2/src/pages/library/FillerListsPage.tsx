import AddCircleIcon from '@mui/icons-material/AddCircle';

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

export default function FillerListsPage() {
  // Placeholder...
  const fillerLists = [];
  const getTableRows = () => {
    if (fillerLists.length === 0) {
      return (
        <TableRow>
          <TableCell sx={{ py: 3, textAlign: 'center' }} colSpan={3}>
            No Filler Lists!
          </TableCell>
        </TableRow>
      );
    }
    return null;
  };

  return (
    <Box>
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
