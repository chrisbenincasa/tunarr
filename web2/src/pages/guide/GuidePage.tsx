import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Channel } from 'dizquetv-types';

export default function GuidePage() {
  const { isPending, error, data } = useQuery({
    queryKey: ['channels'],
    queryFn: () =>
      fetch('http://localhost:8000/api/channels').then(
        (res) => res.json() as Promise<Channel[]>,
      ),
  });

  if (isPending) return 'Loading...';

  if (error) return 'An error occurred!: ' + error.message;

  return (
    <Typography component="h1">
      {data.map((channel) => (
        <Box component="section" sx={{ p: 2, border: '1px dashed grey' }}>
          This is a section container {channel.number}
        </Box>
      ))}
    </Typography>
  );
}
