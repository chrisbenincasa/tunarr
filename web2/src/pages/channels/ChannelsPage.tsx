import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ChannelsPage() {
  const { isPending, error, data } = useQuery({
    queryKey: ['test'],
    queryFn: () =>
      fetch('http://localhost:8000/api/channels').then((res) => res.json()),
  });

  if (isPending) return 'Loading...';

  if (error) return 'An error occurred!: ' + error.message;

  // TODO properly define types from API
  const getDataTableRow = (channel) => {
    return (
      <TableRow key={channel.number}>
        <TableCell width="10%">{channel.number}</TableCell>
        <TableCell width="10%">
          <img style={{ maxHeight: '40px' }} src={channel.icon.path} />
        </TableCell>
        <TableCell>{channel.name}</TableCell>
        <TableCell width="10%">
          <IconButton color="error">
            <DeleteIcon />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  const getTableRows = () => {
    if (isPending) {
      return (
        <TableRow key="pending">
          <TableCell colSpan={4}>Loading....</TableCell>
        </TableRow>
      );
    } else if (error) {
      return (
        <TableRow key="pending">
          <TableCell colSpan={4}>Error</TableCell>
        </TableRow>
      );
    } else {
      return data.map(getDataTableRow);
    }
  };

  return (
    <div>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Icon</TableCell>
              <TableCell>Name</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{getTableRows()}</TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
