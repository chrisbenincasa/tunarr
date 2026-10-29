import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';
import { CopyToClipboardButton } from '@/components/base/CopyToClipboardButton.tsx';
import { useChannelsSuspense } from '@/hooks/useChannels.ts';
import { useM3ULink } from '@/hooks/useM3ULink.ts';
import { useSetOnboardingComplete } from '@/hooks/useOnboarding.ts';
import { getApiErrorMessage } from '@/helpers/apiError.ts';
import { useSystemHealthChecks } from '@/hooks/useSystemHealthChecks.ts';
import { useSystemState } from '@/hooks/useSystemSettings.ts';
import { useXmlTvLink } from '@/hooks/useXmlTvLink.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Add,
  CheckCircle,
  Edit,
  Info,
  OpenInNew,
  RadioButtonUnchecked,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSnackbar } from 'notistack';
import type { ReactNode } from 'react';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import ConnectMediaSources from '../../components/settings/ConnectMediaSources.tsx';
import { getApiMediaSourcesOptions } from '../../generated/@tanstack/react-query.gen.ts';
import {
  hasScannedLibrary,
  isFfmpegOk,
  showFfmpegStep,
  syncedLibraries,
} from './welcomeChecklist.ts';

type StepStatus = 'done' | 'todo' | 'attention' | 'optional';

const docsLink = (path: string) => `https://tunarr.com/${path}`;

export default function WelcomePage() {
  const navigate = useNavigate();
  const { t } = useLingui();
  const snackbar = useSnackbar();
  const setOnboardingComplete = useSetOnboardingComplete();

  // Poll until the first scan lands so the checklist updates on its own.
  const { data: mediaSources } = useSuspenseQuery({
    ...getApiMediaSourcesOptions(),
    refetchInterval: (query) =>
      hasScannedLibrary(query.state.data) ? false : 5_000,
  });
  const { data: channels } = useChannelsSuspense();
  const { data: healthChecks } = useSystemHealthChecks();
  const { data: systemState } = useSystemState();
  const m3uLink = useM3ULink();
  const xmlTvLink = useXmlTvLink();

  const libraries = syncedLibraries(mediaSources);
  const hasSource = mediaSources.length > 0;
  const hasLibrary = libraries.length > 0;
  const hasScan = hasScannedLibrary(mediaSources);
  const ffmpegCheck = healthChecks['FfmpegVersion'];
  const ffmpegOk = isFfmpegOk(ffmpegCheck);
  const hasChannel = channels.length > 0;
  const allDone = hasLibrary && hasScan && ffmpegOk && hasChannel;

  const complete = () => {
    setOnboardingComplete.mutate(
      { body: { complete: true } },
      {
        onSuccess: () => {
          navigate({ to: '/guide' }).catch(console.warn);
        },
        onError: (error) => {
          const message = getApiErrorMessage(error) ?? error.message;
          snackbar.enqueueSnackbar(
            t`Could not save setup progress. ${message}`,
            {
              variant: 'error',
            },
          );
        },
      },
    );
  };

  return (
    <PaddedPaper>
      <Box sx={{ maxWidth: 750, mx: 'auto', py: 6 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <TunarrLogo style={{ width: '4rem', height: '4rem' }} />
          <Typography variant="h3">
            <Trans>Welcome to Tunarr!</Trans>
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            <Trans>
              Follow these steps to set up your first channel. Each step will
              update upon completion. You can skip setup at any time and do all
              of this from the menu later.
            </Trans>
          </Typography>
        </Box>

        <Stack spacing={2}>
          <ChecklistStep
            status={hasLibrary ? 'done' : hasSource ? 'attention' : 'todo'}
            title={<Trans>Connect a media source</Trans>}
            docsUrl={docsLink('configure/media_sources/')}
          >
            <Typography>
              <Trans>
                Media sources provide the content for your channels. Tunarr
                supports Plex, Jellyfin, Emby, and local folders.
              </Trans>
            </Typography>
            {hasSource && !hasLibrary && (
              <Alert severity="warning">
                <Trans>
                  No libraries are enabled yet. Tunarr only syncs content from
                  enabled libraries, so choose at least one below.
                </Trans>
              </Alert>
            )}
            {hasSource && <ConnectMediaSources sx={{ py: 0 }} />}
            <Box>
              <AddMediaSourceButton
                ButtonProps={{ variant: hasSource ? 'outlined' : 'contained' }}
              />
            </Box>
          </ChecklistStep>

          <ChecklistStep
            status={hasScan ? 'done' : 'todo'}
            title={<Trans>Scan your libraries</Trans>}
            docsUrl={docsLink(
              'configure/media_sources/#how-media-sources-work',
            )}
          >
            <Typography>
              <Trans>
                Tunarr scans enabled libraries in the background. Channels can
                only use programs that have been scanned by Tunarr.
              </Trans>
            </Typography>
            {hasLibrary && !hasScan && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <Trans>Waiting for the first scan to finish...</Trans>
                </Typography>
                <LinearProgress />
              </Box>
            )}
          </ChecklistStep>

          {showFfmpegStep(systemState.isInContainer, ffmpegCheck) && (
            <ChecklistStep
              status={ffmpegOk ? 'done' : 'attention'}
              title={<Trans>Check FFmpeg</Trans>}
              docsUrl={docsLink('configure/ffmpeg/')}
            >
              <Typography>
                {systemState.isInContainer ? (
                  <Trans>
                    Tunarr uses FFmpeg to transcode streams. Your container
                    image includes it, but Tunarr could not use it.
                  </Trans>
                ) : (
                  <Trans>
                    Tunarr uses FFmpeg 6.1 or newer to transcode streams.
                  </Trans>
                )}
              </Typography>
              {ffmpegCheck !== undefined && ffmpegCheck.type !== 'healthy' && (
                <Alert
                  severity={ffmpegCheck.type}
                  action={
                    <RouterButtonLink
                      to="/settings/ffmpeg"
                      color="inherit"
                      startIcon={<Edit />}
                    >
                      <Trans>Settings</Trans>
                    </RouterButtonLink>
                  }
                >
                  {ffmpegCheck.context}
                </Alert>
              )}
            </ChecklistStep>
          )}

          <ChecklistStep
            status={hasChannel ? 'done' : 'todo'}
            title={<Trans>Create a channel</Trans>}
            docsUrl={docsLink('configure/channels/')}
          >
            <Typography>
              <Trans>
                Channels play your content on a schedule, like live TV.
              </Trans>
            </Typography>
            <Box>
              <RouterButtonLink
                to="/channels/new"
                variant={hasScan && !hasChannel ? 'contained' : 'outlined'}
                startIcon={<Add />}
              >
                <Trans>New Channel</Trans>
              </RouterButtonLink>
            </Box>
          </ChecklistStep>

          <ChecklistStep
            status="optional"
            title={<Trans>Watch from a client</Trans>}
            docsUrl={docsLink('configure/clients/')}
          >
            <Typography>
              <Trans>
                Add these links to an IPTV client. Jellyfin and Emby can use
                Tunarr as either an M3U source or an HDHomeRun tuner. Plex can
                add Tunarr as an HDHomeRun tuner.
              </Trans>
            </Typography>
            <ClientLink label={<Trans>M3U playlist</Trans>} url={m3uLink} />
            <ClientLink label={<Trans>XMLTV guide</Trans>} url={xmlTvLink} />
          </ChecklistStep>
        </Stack>

        <Box sx={{ display: 'flex', mt: 4 }}>
          <Button
            color="inherit"
            onClick={complete}
            disabled={setOnboardingComplete.isPending}
          >
            <Trans>Skip Setup</Trans>
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            onClick={complete}
            disabled={!allDone || setOnboardingComplete.isPending}
          >
            <Trans>Finish</Trans>
          </Button>
        </Box>
      </Box>
    </PaddedPaper>
  );
}

type ChecklistStepProps = {
  status: StepStatus;
  title: ReactNode;
  docsUrl: string;
  children: ReactNode;
};

function ChecklistStep({
  status,
  title,
  docsUrl,
  children,
}: ChecklistStepProps) {
  const icon = {
    done: <CheckCircle color="success" />,
    todo: <RadioButtonUnchecked color="disabled" />,
    attention: <Warning color="warning" />,
    optional: <Info color="info" />,
  }[status];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2}>
        <Box sx={{ pt: 0.25 }}>{icon}</Box>
        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
              {title}
            </Typography>
            <Link
              href={docsUrl}
              target="_blank"
              rel="noopener"
              variant="body2"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <Trans>Docs</Trans>
              <OpenInNew sx={{ fontSize: 'inherit' }} />
            </Link>
          </Stack>
          {children}
        </Stack>
      </Stack>
    </Paper>
  );
}

function ClientLink({ label, url }: { label: ReactNode; url: string }) {
  return (
    <Typography sx={{ overflowWrap: 'anywhere' }}>
      <strong>{label}:</strong>{' '}
      <Link href={url} target="_blank">
        {url}
      </Link>
      <CopyToClipboardButton content={url} />
    </Typography>
  );
}
