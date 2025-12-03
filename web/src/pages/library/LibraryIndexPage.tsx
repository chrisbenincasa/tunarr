import { Box, Stack, Typography } from '@mui/material';
import { MediaSourceLibraryTable } from '../../components/MediaSourceLibraryTable.tsx';

export default function LibraryIndexPage() {
  return (
    <Box>
      <Typography variant="h3" mb={2}>
        Library
      </Typography>
      <Stack gap={2}>
        <MediaSourceLibraryTable />
      </Stack>
    </Box>
  );
}
