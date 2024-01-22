import { Box, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';

export default function LibraryIndexPage() {
  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="column" spacing={2}>
        <PaddedPaper
          component={Link}
          to="/library/filler"
          sx={{ textDecoration: 'none' }}
        >
          <Typography variant="h5" mb={1}>
            Filler&hellip;
          </Typography>
          <Typography variant="body1">
            Filler lists are collections of videos that you may want to play
            during 'flex' time segments. Flex is time within a channel that does
            not have a program scheduled (usually used for padding).
          </Typography>
        </PaddedPaper>
        <PaddedPaper
          component={Link}
          to="/library/custom-shows"
          sx={{ textDecoration: 'none' }}
        >
          <Typography variant="h5" mb={1}>
            Custom Shows&hellip;
          </Typography>
          <Typography variant="body1">
            Custom Shows are sequences of videos that represent a episodes of a
            virtual TV show. When you add these shows to a channel, the schedule
            tools will treat the videos as if they belonged to a single TV show.
          </Typography>
        </PaddedPaper>
      </Stack>
    </Box>
  );
}
