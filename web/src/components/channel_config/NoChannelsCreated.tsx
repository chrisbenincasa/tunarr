import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useChannels } from '../../hooks/useChannels';
import PaddedPaper from '../base/PaddedPaper';

export default function NoChannelsCreated() {
  const { isFetching: channelsFetching, data: channels } = useChannels();

  return (
    channels &&
    channels.length === 0 &&
    !channelsFetching && (
      <PaddedPaper
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 10,
          textAlign: 'center',
        }}
      >
        <Box>
          <SettingsRemoteIcon fontSize="large" />
          <Typography variant="h5">
            You haven't created any channels yet.
          </Typography>
          <Button
            variant="contained"
            sx={{
              my: 2,
              maxWidth: 350,
              textAlign: 'center',
            }}
            component={RouterLink}
            to="/channels/new"
          >
            Create a Channel
          </Button>
        </Box>
      </PaddedPaper>
    )
  );
}
