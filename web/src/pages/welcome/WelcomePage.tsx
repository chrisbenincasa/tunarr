import { ArrowBack, ArrowForward, Edit } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import AddPlexServer from '../../components/settings/AddPlexServer.tsx';
import ConnectPlex from '../../components/settings/ConnectPlex.tsx';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { useVersion } from '../../hooks/useVersion.ts';
import { updateShowWelcomeState } from '../../store/themeEditor/actions.ts';

const steps = ['Connect Plex', 'Install FFMPEG', 'All Set!'];

export default function WelcomePage() {
  const [isPlexConnected, setIsPlexConnected] = React.useState<boolean>(false);
  const [isFfmpegInstalled, setIsFfmpegInstalled] =
    React.useState<boolean>(false);
  const navigate = useNavigate();

  const { data: version } = useVersion();
  const { data: plexServers, isLoading: isPlexLoading } =
    usePlexServerSettings();

  useEffect(() => {
    if (plexServers && plexServers.length > 0 && !isPlexLoading) {
      setIsPlexConnected(true);
    }

    if (version && version.ffmpeg != 'Error') {
      setIsFfmpegInstalled(true);
    }
  }, [plexServers, version, isPlexLoading]);

  const header = (
    <>
      <TunarrLogo
        style={{
          width: '4rem',
          height: '4rem',
          margin: '0 auto',
          textAlign: 'center',
        }}
      />

      <Typography variant="h3">Welcome to Tunarr!</Typography>
    </>
  );

  const [activeStep, setActiveStep] = React.useState(0);
  const [skipped, setSkipped] = React.useState(new Set<number>());

  const isStepOptional = (step: number) => {
    return step === 1;
  };

  const isStepSkipped = (step: number) => {
    return skipped.has(step);
  };

  const handleNext = () => {
    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setSkipped(newSkipped);
  };

  const handleFinish = () => {
    updateShowWelcomeState();
    navigate('/channels/new');
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSkip = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setSkipped((prevSkipped) => {
      const newSkipped = new Set(prevSkipped.values());
      newSkipped.add(activeStep);
      return newSkipped;
    });
  };

  const getStarted = (
    <>
      <Typography variant="body1">Let's get started...</Typography>
      <Box sx={{ width: '100%', maxWidth: '750px', margin: '0 auto', mt: 4 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label, index) => {
            const stepProps: { completed?: boolean } = {};
            const labelProps: {
              optional?: React.ReactNode;
            } = {};
            if (isStepOptional(index)) {
              labelProps.optional = (
                <Typography variant="caption">(Optional)</Typography>
              );
            }
            if (isStepSkipped(index)) {
              stepProps.completed = false;
            }
            return (
              <Step key={label} {...stepProps}>
                <StepLabel {...labelProps}>{label}</StepLabel>
              </Step>
            );
          })}
        </Stepper>

        <React.Fragment>
          {activeStep === 0 && (
            <>
              <Typography
                variant="h6"
                fontWeight={600}
                align="left"
                sx={{ mt: 3 }}
              >
                Connect Plex
              </Typography>
              <Typography sx={{ mb: 3 }} align="left">
                To use Tunarr, you need to first connect your Plex library. This
                will allow you to build custom channels with any of your plex
                content.
              </Typography>

              {!isPlexConnected ? (
                <Alert
                  variant="filled"
                  severity="error"
                  action={
                    <AddPlexServer title={'Connect Plex'} variant="outlined" />
                  }
                >
                  Plex is not connected.
                </Alert>
              ) : (
                <Alert variant="filled" severity="success">
                  Plex is connected.
                </Alert>
              )}
              {isPlexConnected && <ConnectPlex />}
            </>
          )}
          {activeStep === 1 && (
            <>
              <Typography
                variant="h6"
                fontWeight={600}
                align="left"
                sx={{ mt: 3 }}
              >
                Install FFMPEG
              </Typography>
              <Typography sx={{ mb: 3 }} align="left">
                FFMPEG transcoding is required for some features like channel
                overlay, subtitles, and measures to prevent issues when
                switching episodes. While FFMPEG is optional, we recommend using
                it for the best Tunnar experience.
              </Typography>

              {isFfmpegInstalled ? (
                <Alert variant="filled" severity="success">
                  FFMPEG is installed. Detected version {version?.ffmpeg}
                </Alert>
              ) : (
                <>
                  <Alert
                    variant="filled"
                    severity="warning"
                    action={
                      <Button
                        component={RouterLink}
                        to={`/settings/ffmpeg`}
                        color="inherit"
                        startIcon={<Edit />}
                      >
                        Edit
                      </Button>
                    }
                  >
                    FFMPEG is not detected.
                  </Alert>
                  <Typography sx={{ my: 3 }} align="left">
                    If you are confident FFMPEG is installed, you may just need
                    to update the executable path in the settings. To do so,
                    simply click Edit above to update the path.
                  </Typography>
                </>
              )}
            </>
          )}
          {activeStep === 2 && (
            <>
              {' '}
              <Typography
                variant="h6"
                fontWeight={600}
                align="left"
                sx={{ mt: 3 }}
              >
                You're All Set!
              </Typography>
              <Typography sx={{ mb: 3 }} align="left">
                Congrats, you're ready to start building channels! Just click
                Finish below to start working on your first channel.
              </Typography>
            </>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
              variant="outlined"
              startIcon={<ArrowBack />}
            >
              Back
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            {isStepOptional(activeStep) && (
              <Button color="inherit" onClick={handleSkip} sx={{ mr: 1 }}>
                Skip
              </Button>
            )}
            {activeStep !== steps.length - 1 ? (
              <Button
                onClick={handleNext}
                variant="contained"
                disabled={activeStep === 0 && !isPlexConnected}
                endIcon={<ArrowForward />}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                variant="contained"
                color="primary"
              >
                Finish
              </Button>
            )}
          </Box>
        </React.Fragment>
      </Box>
    </>
  );

  return (
    <>
      <PaddedPaper>
        <Box
          sx={{
            py: 10,
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'center',
          }}
        >
          {header}
          {getStarted}
        </Box>
      </PaddedPaper>
    </>
  );
}
