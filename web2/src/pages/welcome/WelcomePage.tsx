import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  CheckBox,
  CheckBoxOutlineBlank,
  Elderly,
  FiberNew,
  MilitaryTech,
} from '@mui/icons-material';
import PaddedPaper from '../../components/base/PaddedPaper';
import { usePlexServerSettings } from '../../hooks/settingsHooks';
import { useChannels } from '../../hooks/useChannels.ts';
import React, { useEffect } from 'react';
import { useAllTvGuides } from '../../hooks/useTvGuide';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
  const [isPlexConnected, setIsPlexConnected] = React.useState<boolean>(false);
  const [channelsExist, setChannelsExist] = React.useState<boolean>(false);
  const [programmingExists, setProgrammingExists] =
    React.useState<boolean>(false);
  const [pathway, setPathway] = React.useState<string>('');

  const { data: plexServers } = usePlexServerSettings();
  const { data: channels } = useChannels();
  const startDate = dayjs(new Date(2024, 1, 1)); // a date before user would have been using Tunarr
  const endDate = dayjs(new Date(2024, 1, 31)); // today
  const { data: programming } = useAllTvGuides({
    from: startDate,
    to: endDate,
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (plexServers && plexServers.length > 0) {
      setIsPlexConnected(true);
    }

    if (channels && channels.length > 0) {
      setChannelsExist(true);
    }

    if (programming && programming.length > 0) {
      setProgrammingExists(true);
    }
  }, [plexServers, channels, programming]);

  const handlePathway = (pathway: string) => {
    setPathway(pathway);

    if (pathway === 'advanced') {
      // set global state to hide page
      // navigate to Guide
      navigate('/guide');
    }
  };

  const resetPathway = () => {
    setPathway('');
  };

  const header = (
    <>
      <img
        style={{
          width: '4rem',
          height: '4rem',
          margin: '0 auto',
          textAlign: 'center',
        }}
        src="/dizquetv.png"
      />
      <Typography variant="h3">Welcome to Tunarr!</Typography>
    </>
  );

  const chooseYourPathway = (
    <>
      <Typography variant="body1" sx={{ mb: 4 }}>
        Get started in a way that works for you...
      </Typography>
      <Box
        display={'flex'}
        flexDirection={{ xs: 'column', md: 'row' }}
        justifyContent={'center'}
        columnGap={4}
        rowGap={4}
      >
        <Card sx={{ minWidth: 275, pb: 1, pr: 1, maxWidth: 400 }}>
          <CardContent>
            <FiberNew fontSize="large" />
            <Typography variant="h5" component="div">
              I'm new here.
            </Typography>
            <Typography variant="body2">
              I've never used dizquetv and this is my first time setting up
              Tunarr.
            </Typography>
            <Button
              variant="contained"
              sx={{ my: 2 }}
              onClick={() => handlePathway('get-started')}
            >
              Get Started
            </Button>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 275, pb: 1, pr: 1, maxWidth: 400 }}>
          <CardContent>
            <Elderly fontSize="large" />
            <Typography variant="h5" component="div">
              I've used dizqueTV
            </Typography>
            <Typography variant="body2">
              This isn't my first rodeo. I have an existing dizqueTV database
              that I want to migrate into Tunarr.
            </Typography>
            <Button
              variant="contained"
              sx={{ my: 2 }}
              onClick={() => handlePathway('migration')}
            >
              Get Instructions
            </Button>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 275, pb: 1, pr: 1, maxWidth: 400 }}>
          <CardContent>
            <MilitaryTech fontSize="large" />
            <Typography variant="h5" component="div">
              Advanced
            </Typography>
            <Typography variant="body2">
              I know what I am doing and don't need any instructions. Please
              leave me alone.
            </Typography>
            <Button
              variant="contained"
              sx={{ my: 2 }}
              onClick={() => handlePathway('advanced')}
            >
              Hide this page
            </Button>
          </CardContent>
        </Card>
      </Box>
    </>
  );

  const getStarted = (
    <>
      <Typography variant="body1">
        Here are a few things to do to get started...
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'left',
          maxWidth: 500,
          margin: '2em auto',
        }}
      >
        <Stack direction={'row'} spacing={1}>
          {isPlexConnected ? <CheckBox /> : <CheckBoxOutlineBlank />}
          <Typography variant="body1">Connect your Plex Server</Typography>
        </Stack>
        <Stack direction={'row'} spacing={1}>
          {channelsExist ? <CheckBox /> : <CheckBoxOutlineBlank />}
          <Typography variant="body1">Create your first channel</Typography>
        </Stack>
        <Stack direction={'row'} spacing={1}>
          {programmingExists ? <CheckBox /> : <CheckBoxOutlineBlank />}
          <Typography variant="body1">Add programming to a channel</Typography>
        </Stack>
      </Box>
    </>
  );

  // to do: write proper migration instructions or just write new ones in wiki and link to it
  const migration = (
    <Box textAlign={'left'} margin={'0 auto'}>
      <Typography variant="body1">
        We've made migrating from dizqueTV easy...
      </Typography>
      <Typography>1.) Stop your existing dizqueTV</Typography>
      <Typography>2.) Take a backup of your .dizquetv folder.</Typography>
      <Typography>
        3.) Within your new Tunarr install, replace your .dizquetv folder with
        the one you just backed up.
      </Typography>
      <Typography>
        3.) Startup Tunarr, it might need a couple of minutes to migrate the
        databases. It's a good idea to pay attention to the logs during this.
      </Typography>
    </Box>
  );

  return (
    <>
      <PaddedPaper>
        {pathway && (
          <Button startIcon={<ArrowBack />} onClick={() => resetPathway()}>
            Go Back
          </Button>
        )}
        <Box
          sx={{
            py: 10,
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'center',
          }}
        >
          {header}
          {!pathway
            ? chooseYourPathway
            : pathway === 'get-started'
            ? getStarted
            : pathway === 'migration'
            ? migration
            : null}
        </Box>
      </PaddedPaper>
    </>
  );
}
