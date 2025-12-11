import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';
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
import { useNavigate } from '@tanstack/react-router';
import { isEmpty } from 'lodash-es';
import pluralize from 'pluralize';
import React, { useEffect } from 'react';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import ConnectMediaSources from '../../components/settings/ConnectMediaSources.tsx';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import { useVersion } from '../../hooks/useVersion.tsx';
import { updateShowWelcomeState } from '../../store/themeEditor/actions.ts';

const steps = ['Connect Sources', 'Install FFMPEG', 'All Set!'];

export default function WelcomePage() {
  const [hasMediaSource, setHasMediaSource] = React.useState<boolean>(false);
  const [isFfmpegInstalled, setIsFfmpegInstalled] =
    React.useState<boolean>(false);
  const navigate = useNavigate();

  const { data: version } = useVersion();
  const { data: mediaSources, isLoading: mediaSourcesLoading } =
    useMediaSources();

  useEffect(() => {
    if (!isEmpty(mediaSources) && !mediaSourcesLoading) {
      setHasMediaSource(true);
    }

    if (version && version.ffmpeg !== 'Error' && version.ffmpeg !== 'unknown') {
      setIsFfmpegInstalled(true);
    }
  }, [mediaSources, mediaSourcesLoading, version]);

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
    navigate({ to: '/channels/new' }).catch(console.warn);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const getStarted = (
    <>
      <Typography variant="body1">Let's get started...</Typography>
      <Box sx={{ width: '100%', maxWidth: '750px', margin: '0 auto', mt: 4 }}>
        <Stepper alternativeLabel activeStep={activeStep}>
          {steps.map((label, index) => {
            const stepProps: { completed?: boolean } = {};
            if (isStepSkipped(index)) {
              stepProps.completed = false;
            }
            return (
              <Step key={label} {...stepProps}>
                <StepLabel>{label}</StepLabel>
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
                Connect Media Sources
              </Typography>
              <Typography sx={{ mb: 3 }} align="left">
                To use Tunarr, you must first connect at least one media source.
                Media sources provide all content used to create channels in
                Tunarr. Plex and Jellyfin are currently supported.
              </Typography>

              {!hasMediaSource ? (
                <Alert
                  sx={{
                    alignItems: 'center',
                  }}
                  variant="filled"
                  severity="error"
                  action={
                    <AddMediaSourceButton
                      ButtonProps={{
                        variant: 'outlined',
                        color: 'inherit',
                        size: 'small',
                      }}
                    />
                  }
                >
                  <Typography>No media sources connected.</Typography>
                </Alert>
              ) : (
                <Alert variant="filled" severity="success">
                  {mediaSources.length}{' '}
                  {pluralize('source', mediaSources.length)} connected.
                </Alert>
              )}
              {hasMediaSource && <ConnectMediaSources />}
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
                switching episodes.
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
                      <RouterButtonLink
                        to={`/settings/ffmpeg`}
                        color="inherit"
                        startIcon={<Edit />}
                      >
                        Edit
                      </RouterButtonLink>
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

            {activeStep !== steps.length - 1 ? (
              <Button
                onClick={handleNext}
                variant="contained"
                disabled={activeStep === 0 && !hasMediaSource}
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
