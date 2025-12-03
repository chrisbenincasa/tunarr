import Changelog from '@/assets/CHANGELOG.md?raw';
import { RotatingLoopIcon } from '@/components/base/LoadingIcon';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useM3ULink } from '@/hooks/useM3ULink';
import { useSystemHealthChecks } from '@/hooks/useSystemHealthChecks';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useXmlTvLink } from '@/hooks/useXmlTvLink';
import { useSettings } from '@/store/settings/selectors';
import {
  CheckCircle,
  ContentCopy,
  Error,
  Info,
  QuestionMark,
  Refresh,
  Warning,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  IconButton,
  type IconButtonProps,
  LinearProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { compact, isEmpty, map, reject, take } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useState, useTransition } from 'react';
import Markdown from 'react-markdown';
import { match } from 'ts-pattern';
import {
  getApiSystemHealthQueryKey,
  postApiSystemFixersByFixerIdRunMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

// TODO: Get these from server.
// const MissingSeasonNumbersCheck = 'MissingSeasonNumbers';
const FfmpegVersionCheck = 'FfmpegVersion';
const HardwareAccelerationCheck = 'HardwareAcceleration';
const FfmpegDebugLoggingCheck = 'FfmpegDebugLogging';
// const MissingProgramAssociationsHealthCheck =
//   'MissingProgramAssociationsHealthCheck';
const FfmpegTranscodeDirectory = 'FfmpegTranscodeDirectory';
const BaseImageHealthCheck = 'BaseImageHealthCheck';

const AllKnownChecks = [
  FfmpegVersionCheck,
  HardwareAccelerationCheck,
  FfmpegTranscodeDirectory,
  FfmpegDebugLoggingCheck,
  // MissingSeasonNumbersCheck,
  // MissingProgramAssociationsHealthCheck,
  BaseImageHealthCheck,
] as const;

const CopyToClipboardButton = (
  props: IconButtonProps & { content: string },
) => {
  const copyToClipboard = useCopyToClipboard();

  const handleClick = (e: React.SyntheticEvent) => {
    e.preventDefault();
    copyToClipboard(props.content).catch(console.warn);
  };

  return (
    <IconButton
      disableRipple
      sx={{ ml: 0.5, cursor: 'pointer', p: 0 }}
      size="small"
      onClick={handleClick}
      {...props}
    >
      <ContentCopy sx={{ fontSize: 'inherit' }} />
    </IconButton>
  );
};

const ChunkedChangelog = Changelog.split(/(?=\n##\s)/g);

export const StatusPage = () => {
  const { backendUri } = useSettings();
  const systemSettings = useSystemSettings();
  const systemHealthQuery = useSystemHealthChecks();
  const xmlTvLink = useXmlTvLink();
  const m3uLink = useM3ULink();
  const [changlogPending, startChangelogTransition] = useTransition();
  const [changelogLinesVisible, setChangelogLinesVisible] = useState(6);

  const [runningFixers, setRunningFixers] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

  const runSystemFixer = useMutation({
    ...postApiSystemFixersByFixerIdRunMutation(),
    onSuccess: async (_, { path: { fixerId } }) => {
      await queryClient.invalidateQueries({
        queryKey: getApiSystemHealthQueryKey(),
      });
      snackbar.enqueueSnackbar(`Successfully ran system fixer ${fixerId}`, {
        variant: 'success',
      });
    },
    onError: (err, { path: { fixerId } }) => {
      console.error(err);
      snackbar.enqueueSnackbar(
        `Error while running system fixer ${fixerId}. Check server logs for details.`,
        { variant: 'error' },
      );
    },
    onSettled: (_data, _error, { path: { fixerId } }) => {
      setRunningFixers(
        (prev) => new Set(reject([...prev], (n) => n === fixerId)),
      );
    },
  });

  const renderHealthCheckResults = () => {
    const checkRows = compact(
      map(AllKnownChecks, (check) => {
        const prettyName = match(check)
          // .with(MissingSeasonNumbersCheck, () => 'Missing Season Numbers')
          .with(FfmpegVersionCheck, () => 'FFmpeg Version')
          .with(HardwareAccelerationCheck, () => 'Hardware Acceleration')
          .with(FfmpegDebugLoggingCheck, () => 'FFmpeg Report Logging')
          // .with(
          //   MissingProgramAssociationsHealthCheck,
          //   () => 'Missing Program Associations',
          // )
          .with(FfmpegTranscodeDirectory, () => 'FFmpeg Transcode Directory')
          .with(BaseImageHealthCheck, () => 'Base Docker Image Tag')
          .exhaustive();

        const fixer = match(check)
          // .with(MissingSeasonNumbersCheck, () => 'MissingSeasonNumbersFixer')
          // .with(
          //   MissingProgramAssociationsHealthCheck,
          //   () => 'BackfillProgramGroupings',
          // )
          .otherwise(() => null);

        const data = systemHealthQuery.data?.[check];

        const icon =
          fixer && runningFixers.has(fixer) ? (
            <RotatingLoopIcon />
          ) : (
            match(data?.type)
              .with('error', () => <Error color="error" />)
              .with('warning', () => <Warning color="warning" />)
              .with('healthy', () => <CheckCircle color="success" />)
              .with('info', () => <Info color="info" />)
              .otherwise(() =>
                systemHealthQuery.isLoading ? (
                  <RotatingLoopIcon />
                ) : (
                  <QuestionMark />
                ),
              )
          );

        return (
          <TableRow hover key={check}>
            <TableCell width="1em">{icon}</TableCell>
            <TableCell sx={{ minWidth: '10em' }}>
              <Typography>{prettyName}</Typography>
            </TableCell>
            <TableCell>
              {data?.type !== 'healthy' && (
                <Typography>{data?.context}</Typography>
              )}
            </TableCell>
            <TableCell>
              {fixer && data && data.type !== 'healthy' && (
                <Button
                  variant="contained"
                  disabled={runningFixers.has(fixer)}
                  onClick={() => {
                    // Have to make a new set of react won't re-render
                    setRunningFixers((prev) => new Set([...prev, fixer]));
                    runSystemFixer.mutate({ path: { fixerId: fixer } });
                  }}
                >
                  Attempt Auto-Fix
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      }),
    );

    return (
      <Table>
        <TableBody>{checkRows}</TableBody>
      </Table>
    );
  };

  const actualBackendUri = isEmpty(backendUri)
    ? window.location.origin
    : backendUri;

  return (
    <Box>
      <Stack gap={2} useFlexGap>
        <Stack gap={2} useFlexGap direction={['column', 'row']}>
          <Box sx={{ pb: 2, flex: 1 }}>
            <Typography sx={{ mb: 1 }} variant="h5">
              System Health
            </Typography>
            {systemHealthQuery.isLoading && <LinearProgress />}
            {renderHealthCheckResults()}
          </Box>
          <Divider orientation={'vertical'} flexItem={true} />
          {/* <PaddedPaper> */}

          <Box sx={{ pb: 2, flex: 1 }}>
            <Typography sx={{ mb: 1 }} variant="h5">
              System Info
            </Typography>
            {systemSettings.isLoading && <LinearProgress />}
            {systemSettings.data && (
              <Table>
                <TableBody>
                  <TableRow hover>
                    <TableCell>
                      <Typography>
                        <strong>Tunarr Backend URL:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>
                        <Link href={actualBackendUri} target="_blank">
                          {actualBackendUri}
                        </Link>
                        <CopyToClipboardButton content={actualBackendUri} />
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Typography>
                        <strong>Search Server URL:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>
                        <Link
                          href={systemSettings.data.searchServerAddress}
                          target="_blank"
                        >
                          {systemSettings.data.searchServerAddress}
                        </Link>
                        <CopyToClipboardButton
                          content={systemSettings.data.searchServerAddress}
                        />
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell>
                      <Typography>
                        <strong>XMLTV Link:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>
                        <Link href={xmlTvLink} target="_blank">
                          {xmlTvLink}
                        </Link>
                        <CopyToClipboardButton content={xmlTvLink} />
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell>
                      <Typography>
                        <strong>Channels M3U Link:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>
                        <Link href={m3uLink} target="_blank">
                          {m3uLink}
                        </Link>
                        <CopyToClipboardButton content={m3uLink} />
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell>
                      <Typography>
                        <strong>Data Directory:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{ display: 'flex', alignItems: 'center' }}
                      >
                        <span>{systemSettings.data.dataDirectory}</span>
                        <CopyToClipboardButton
                          content={systemSettings.data.dataDirectory}
                        />
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell>
                      <Typography>
                        <strong>Logs Directory:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{ display: 'flex', alignItems: 'center' }}
                      >
                        <span>{systemSettings.data.logging.logsDirectory}</span>
                        <CopyToClipboardButton
                          content={systemSettings.data.logging.logsDirectory}
                        />
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell>
                      <Typography>
                        <strong>Backups:</strong>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>
                        {isEmpty(systemSettings.data.backup.configurations)
                          ? 'Disabled'
                          : 'Enabled'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </Box>
        </Stack>
        {/* </PaddedPaper> */}
        {/* <PaddedPaper sx={{ maxHeight: 400, overflowY: 'scroll' }}> */}
        <Divider orientation={'horizontal'} />

        <Box>
          {map(take(ChunkedChangelog, changelogLinesVisible), (chunk, idx) => (
            <Markdown
              key={`chunk_${idx}`}
              components={{
                h1: ({ children }) => (
                  <Typography variant="h4" gutterBottom>
                    {children}
                  </Typography>
                ),
                h2: ({ children }) => (
                  <Typography variant="h5" gutterBottom>
                    {children}
                  </Typography>
                ),
                h3: ({ children }) => (
                  <Typography variant="h6" gutterBottom>
                    {children}
                  </Typography>
                ),
                text: ({ children }) => (
                  <Typography variant="body1">{children}</Typography>
                ),
                a: ({ children, href }) => (
                  <Link href={href} target="_blank">
                    {children}
                  </Link>
                ),
              }}
            >
              {chunk}
            </Markdown>
          ))}
        </Box>
        {changlogPending && <LinearProgress />}
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            py: 2,
          }}
        >
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={() =>
              startChangelogTransition(() =>
                setChangelogLinesVisible((prev) => prev + 10),
              )
            }
            disabled={changelogLinesVisible >= ChunkedChangelog.length}
          >
            Load More
          </Button>
        </Box>
        {/* </PaddedPaper> */}
      </Stack>
    </Box>
  );
};
