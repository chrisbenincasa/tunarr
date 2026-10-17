import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';
import { CopyToClipboardButton } from '@/components/base/CopyToClipboardButton.tsx';
import { useChannels } from '@/hooks/useChannels.ts';
import { useM3ULink } from '@/hooks/useM3ULink.ts';
import { useSetOnboardingComplete } from '@/hooks/useOnboarding.ts';
import { useSystemHealthChecks } from '@/hooks/useSystemHealthChecks.ts';
import { useXmlTvLink } from '@/hooks/useXmlTvLink.ts';
import { Trans } from '@lingui/react/macro';
import {
  Add,
  CheckCircle,
  Edit,
  Info,
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
import type { MediaSourceSettings } from '@tunarr/types';
import type { ReactNode } from 'react';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import ConnectMediaSources from '../../components/settings/ConnectMediaSources.tsx';
import { getApiMediaSourcesOptions } from '../../generated/@tanstack/react-query.gen.ts';

type StepStatus = 'done' | 'todo' | 'attention' | 'optional';

// Local sources sync every library they have.
const syncedLibraries = (sources: MediaSourceSettings[]) =>
  sources.flatMap((source) =>
    source.libraries.filter((lib) => source.type === 'local' || lib.enabled),
  );

const hasScannedLibrary = (sources: MediaSourceSettings[] | undefined) =>
  (sources ?? []).length > 0 &&
  syncedLibraries(sources ?? []).some((lib) => lib.lastScannedAt !== undefined);

export default function WelcomePage() {
  const navigate = useNavigate();
  const setOnboardingComplete = useSetOnboardingComplete();

  // Poll until the first scan lands so the checklist updates on its own.
  const { data: mediaSources } = useSuspenseQuery({
    ...getApiMediaSourcesOptions(),
    refetchInterval: (query) =>
      hasScannedLibrary(query.state.data) ? false : 5_000,
  });
  const { data: channels } = useChannels();
  const { data: healthChecks } = useSystemHealthChecks();
  const m3uLink = useM3ULink();
  const xmlTvLink = useXmlTvLink();

  const libraries = syncedLibraries(mediaSources);
  const hasSource = mediaSources.length > 0;
  const hasLibrary = libraries.length > 0;
  const hasScan = hasScannedLibrary(mediaSources);
  const ffmpegCheck = healthChecks['FfmpegVersion'];
  const ffmpegOk =
    ffmpegCheck === undefined ||
    ffmpegCheck.type === 'healthy' ||
    ffmpegCheck.type === 'info';
  const hasChannel = channels.length > 0;
  const allDone = hasLibrary && hasScan && ffmpegOk && hasChannel;

  const complete = () => {
    setOnboardingComplete.mutate(
      { body: { complete: true } },
      {
        onSuccess: () => {
          navigate({ to: '/guide' }).catch(console.warn);
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
              These steps get your first channel on the air. Each one checks
              itself off as you finish it. You can skip setup at any time and do
              all of this from the menu later.
            </Trans>
          </Typography>
        </Box>

        <Stack spacing={2}>
          <ChecklistStep
            status={hasLibrary ? 'done' : hasSource ? 'attention' : 'todo'}
            title={<Trans>Connect a media source</Trans>}
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
          >
            <Typography>
              <Trans>
                Tunarr scans enabled libraries in the background. Channels can
                only use programs that a scan has found.
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

          <ChecklistStep
            status={ffmpegOk ? 'done' : 'attention'}
            title={<Trans>Check FFmpeg</Trans>}
          >
            <Typography>
              <Trans>
                Tunarr uses FFmpeg to transcode streams. Docker images include
                it, so most installs need no changes here.
              </Trans>
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

          <ChecklistStep
            status={hasChannel ? 'done' : 'todo'}
            title={<Trans>Create a channel</Trans>}
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
          >
            <Typography>
              <Trans>
                Add these links to an IPTV player. Plex, Jellyfin, and Emby can
                also add Tunarr as an HDHomeRun tuner.
              </Trans>
            </Typography>
            <ClientLink label={<Trans>M3U playlist</Trans>} url={m3uLink} />
            <ClientLink label={<Trans>XMLTV guide</Trans>} url={xmlTvLink} />
            <Box>
              <RouterButtonLink to="/settings/hdhr" variant="outlined">
                <Trans>HDHomeRun Settings</Trans>
              </RouterButtonLink>
            </Box>
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
  children: ReactNode;
};

function ChecklistStep({ status, title, children }: ChecklistStepProps) {
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
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
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
