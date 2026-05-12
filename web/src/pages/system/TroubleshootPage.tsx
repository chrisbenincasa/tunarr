import { Trans, useLingui } from '@lingui/react/macro';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Download from '@mui/icons-material/Download';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrow from '@mui/icons-material/PlayArrow';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTypeSearchField } from '@tunarr/shared/util';
import type { ProgramOrFolder, TerminalProgram } from '@tunarr/types';
import { getGrandparentItem, isTerminalItemType } from '@tunarr/types';
import type { SearchFilter, SearchRequest } from '@tunarr/types/schemas';
import Hls from 'hls.js';
import { useSnackbar } from 'notistack';
import { useCallback, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { ProgramSearchAutocomplete } from '../../components/ProgramSearchAutocomplete.tsx';
import {
  getApiTranscodeConfigsOptions,
  getChannelsOptions,
} from '../../generated/@tanstack/react-query.gen.ts';
import { postApiTroubleshoot } from '../../generated/index.ts';
import { resolutionToString } from '../../helpers/util.ts';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard.ts';
import { useHls } from '../../hooks/useHls.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import type { Nullable } from '../../types/util.ts';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatOptionTitle(program: TerminalProgram): string {
  return match(program)
    .with(
      { type: P.union('movie', 'other_video', 'music_video') },
      (video) => video.title,
    )
    .with({ type: 'episode' }, (ep) => {
      const show = getGrandparentItem(ep);
      if (!show) return ep.title;
      const season =
        ep.season?.index !== undefined
          ? ep.season?.index?.toString().padStart(2, '0')
          : null;
      return `${ep.title} - ${show.title} (${show.year}) S${season}E${ep.episodeNumber.toString().padStart(2, '0')}`;
    })
    .with({ type: 'track' }, (track) => {
      const artist = getGrandparentItem(track);
      if (!artist) return track.title;
      return `${track.title} - ${artist.title}`;
    })
    .exhaustive();
}

function CopyButton({ text }: { text: string }) {
  const { t } = useLingui();
  const copy = useCopyToClipboard();
  const snackback = useSnackbar();
  const handleCopy = () => {
    copy(text)
      .then(() => {
        snackback.enqueueSnackbar({
          message: t`Successfully copied to clipboard!`,
          variant: 'success',
        });
      })
      .catch((e) => {
        snackback.enqueueSnackbar({
          message: t`Error while copying to clipboard. Check browser logs for details`,
          variant: 'error',
        });
        console.error(e);
      });
  };

  return (
    <Tooltip title={t`Copy to clipboard`}>
      <IconButton size="small" onClick={handleCopy}>
        <ContentCopy fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
        <CopyButton text={text} />
      </Box>
      <Box
        component="pre"
        sx={{
          p: 2,
          pr: 5,
          bgcolor: 'grey.900',
          color: 'grey.100',
          borderRadius: 1,
          overflow: 'auto',
          maxHeight: 400,
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {text}
      </Box>
    </Box>
  );
}

type Props = {
  initialProgram: Nullable<TerminalProgram>;
};

const terminalTypeFilter: SearchFilter = {
  op: 'or',
  type: 'op',
  children: [
    createTypeSearchField('movie'),
    createTypeSearchField('music_video'),
    createTypeSearchField('other_video'),
    createTypeSearchField('episode'),
    createTypeSearchField('track'),
  ],
};

export const TroubleshootPage = ({ initialProgram }: Props) => {
  const { t } = useLingui();
  const { backendUri } = useSettings();

  // Form state
  const [selectedProgram, setSelectedProgram] =
    useState<TerminalProgram | null>(initialProgram);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [transcodeConfigOverride, setTranscodeConfigOverride] =
    useState<string>('');
  const [testDuration, setTestDuration] = useState(30);
  const [searchQuery, setSearchQuery] = useState<SearchRequest>({
    query: '',
    filter: terminalTypeFilter,
    restrictSearchTo: ['title'],
  });

  // Video player
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Data queries
  const { data: channels } = useQuery(getChannelsOptions());
  const { data: transcodeConfigs } = useQuery(getApiTranscodeConfigsOptions());

  // Troubleshoot mutation
  const troubleshootMutation = useMutation({
    mutationFn: async (request: {
      programId: string;
      channelId: string;
      transcodeConfigId?: string;
      testDurationSeconds: number;
    }) => {
      return await postApiTroubleshoot({
        body: request,
        throwOnError: true,
      });
    },
    onSuccess: ({ data }) => {
      // Start HLS playback if test transcode has a session ID
      if (data.testTranscode?.hlsSessionId && data.testTranscode.success) {
        startPlayback(data.testTranscode.hlsSessionId);
      }
    },
  });

  const result = troubleshootMutation.data?.data;

  const { resetHls } = useHls({ startPosition: 0 });

  const startPlayback = useCallback(
    (sessionId: string) => {
      if (!Hls.isSupported()) return;

      const hls = resetHls();

      hls!.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error', data);
      });

      const url = `${backendUri}/api/troubleshoot/stream/${sessionId}/live.m3u8`;
      hls!.loadSource(url);

      if (videoRef.current) {
        hls!.attachMedia(videoRef.current);
      }
      // TODO: snackbar?
    },
    [backendUri, resetHls],
  );

  const handleRun = () => {
    if (!selectedProgram || !selectedChannelId) return;

    troubleshootMutation.mutate({
      programId: selectedProgram.uuid,
      channelId: selectedChannelId,
      transcodeConfigId: transcodeConfigOverride || undefined,
      testDurationSeconds: testDuration,
    });
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tunarr-troubleshoot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const includeProgram = useCallback((item: ProgramOrFolder) => {
    return isTerminalItemType(item);
  }, []);

  const canRun =
    selectedProgram !== null &&
    selectedChannelId !== '' &&
    !troubleshootMutation.isPending;

  return (
    <Box>
      {/* Configuration Form */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h6">
          <Trans>Program Playback Troubleshooter</Trans>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Trans>
            Select a program and channel to test playback. The troubleshooter
            will analyze stream selection, build the FFmpeg pipeline, and run a
            short test transcode.
          </Trans>
        </Typography>

        <ProgramSearchAutocomplete<TerminalProgram>
          searchQuery={searchQuery}
          enabled={searchQuery.query !== undefined && searchQuery.query !== ''}
          value={selectedProgram}
          includeItem={includeProgram}
          onChange={setSelectedProgram}
          onQueryChange={(q) => setSearchQuery({ ...searchQuery, query: q })}
          label={t`Search for a program`}
          renderOptionTitle={formatOptionTitle}
        />

        <FormControl fullWidth>
          <InputLabel>
            <Trans>Channel</Trans>
          </InputLabel>
          <Select
            value={selectedChannelId}
            label={t`Channel`}
            onChange={(e) => setSelectedChannelId(e.target.value)}
          >
            {channels?.map((ch) => (
              <MenuItem key={ch.id} value={ch.id}>
                {ch.number} - {ch.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>
            <Trans>Transcode Config (optional override)</Trans>
          </InputLabel>
          <Select
            value={transcodeConfigOverride}
            label={t`Transcode Config (optional override)`}
            onChange={(e) => setTranscodeConfigOverride(e.target.value)}
          >
            <MenuItem value="">
              <em>
                <Trans>Use channel default</Trans>
              </em>
            </MenuItem>
            {transcodeConfigs?.map((tc) => (
              <MenuItem key={tc.id} value={tc.id}>
                {tc.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          type="number"
          label={t`Test Duration (seconds)`}
          value={testDuration}
          onChange={(e) =>
            setTestDuration(
              Math.min(120, Math.max(5, parseInt(e.target.value) || 30)),
            )
          }
          slotProps={{ htmlInput: { min: 5, max: 120 } }}
          sx={{ maxWidth: 200 }}
        />

        <Box>
          <Button
            variant="contained"
            onClick={handleRun}
            disabled={!canRun}
            startIcon={
              troubleshootMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <PlayArrow />
              )
            }
          >
            {troubleshootMutation.isPending ? (
              <Trans>Running...</Trans>
            ) : (
              <Trans>Run Troubleshooter</Trans>
            )}
          </Button>
        </Box>
      </Stack>

      {troubleshootMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {troubleshootMutation.error.message}
        </Alert>
      )}

      {/* Results */}

      <Box>
        {/* {result.testTranscode?.success && (
          )} */}
        <Box
          sx={{
            mb: 3,
            visibility: result?.testTranscode?.success ? 'visible' : 'hidden',
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            <Trans>Test Playback</Trans>
          </Typography>
          <Box
            sx={{
              width: '100%',
              maxWidth: 800,
            }}
          >
            <video ref={videoRef} style={{ width: '100%' }} controls autoPlay />
          </Box>
        </Box>

        {result && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                size="small"
                startIcon={<ContentCopy />}
                onClick={() =>
                  navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                }
              >
                <Trans>Copy Full Report</Trans>
              </Button>
              <Button
                size="small"
                startIcon={<Download />}
                onClick={handleDownload}
              >
                <Trans>Download JSON</Trans>
              </Button>
            </Stack>

            {/* Errors */}
            {result.errors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <Trans>Errors</Trans>
                </Typography>
                {result.errors.map((err, i) => (
                  <Typography key={i} variant="body2">
                    {err}
                  </Typography>
                ))}
              </Alert>
            )}

            {/* System Info */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">
                  <Trans>System Info</Trans>
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <strong>Tunarr</strong>
                        </TableCell>
                        <TableCell>{result.systemInfo.tunarrVersion}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>FFmpeg</strong>
                        </TableCell>
                        <TableCell>{result.systemInfo.ffmpegVersion}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>Node.js</strong>
                        </TableCell>
                        <TableCell>{result.systemInfo.nodeVersion}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>
                            <Trans>Platform</Trans>
                          </strong>
                        </TableCell>
                        <TableCell>
                          {result.systemInfo.platform} ({result.systemInfo.arch}
                          )
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>
                            <Trans>HW Acceleration</Trans>
                          </strong>
                        </TableCell>
                        <TableCell>
                          {result.systemInfo.availableHwAccels.join(', ') ||
                            'None'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>

            {/* Media Info */}
            {result.mediaInfo && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    <Trans>Media Info</Trans>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        <Trans>Program</Trans>
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>
                                <strong>
                                  <Trans>Title</Trans>
                                </strong>
                              </TableCell>
                              <TableCell>{result.mediaInfo.title}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>
                                <strong>
                                  <Trans>Type</Trans>
                                </strong>
                              </TableCell>
                              <TableCell>{result.mediaInfo.type}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>
                                <strong>
                                  <Trans>Duration</Trans>
                                </strong>
                              </TableCell>
                              <TableCell>
                                {formatDuration(result.mediaInfo.duration)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>
                                <strong>
                                  <Trans>Source</Trans>
                                </strong>
                              </TableCell>
                              <TableCell>
                                {result.mediaInfo.sourceType} (
                                {result.mediaInfo.streamSourceType})
                              </TableCell>
                            </TableRow>
                            {result.mediaInfo.streamSourcePath && (
                              <TableRow>
                                <TableCell>
                                  <strong>
                                    <Trans>Path</Trans>
                                  </strong>
                                </TableCell>
                                <TableCell sx={{ wordBreak: 'break-all' }}>
                                  {result.mediaInfo.streamSourcePath}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    {/* Video Streams */}
                    {result.mediaInfo.videoStreams.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          <Trans>Video Streams</Trans>
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>
                                  <Trans>Codec</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Resolution</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Frame Rate</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Pixel Format</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Bit Depth</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Color</Trans>
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {result.mediaInfo.videoStreams.map((vs) => (
                                <TableRow key={vs.index}>
                                  <TableCell>{vs.index}</TableCell>
                                  <TableCell>
                                    {vs.codec}
                                    {vs.profile ? ` (${vs.profile})` : ''}
                                  </TableCell>
                                  <TableCell>
                                    {vs.width}x{vs.height}
                                  </TableCell>
                                  <TableCell>{vs.framerate ?? '-'}</TableCell>
                                  <TableCell>{vs.pixelFormat ?? '-'}</TableCell>
                                  <TableCell>{vs.bitDepth ?? '-'}</TableCell>
                                  <TableCell>
                                    {[
                                      vs.colorSpace,
                                      vs.colorTransfer,
                                      vs.colorRange,
                                    ]
                                      .filter(Boolean)
                                      .join(' / ') || '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {/* Audio Streams */}
                    {result.mediaInfo.audioStreams.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          <Trans>Audio Streams</Trans>
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>
                                  <Trans>Codec</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Language</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Channels</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Title</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Default</Trans>
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {result.mediaInfo.audioStreams.map((as) => (
                                <TableRow key={as.index}>
                                  <TableCell>{as.index}</TableCell>
                                  <TableCell>{as.codec}</TableCell>
                                  <TableCell>{as.language ?? '-'}</TableCell>
                                  <TableCell>{as.channels ?? '-'}</TableCell>
                                  <TableCell>{as.title ?? '-'}</TableCell>
                                  <TableCell>
                                    {as.default ? 'Yes' : 'No'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {/* Subtitle Streams */}
                    {result.mediaInfo.subtitleStreams.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          <Trans>Subtitle Streams</Trans>
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>
                                  <Trans>Codec</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Language</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Type</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Default</Trans>
                                </TableCell>
                                <TableCell>
                                  <Trans>Forced</Trans>
                                </TableCell>
                                <TableCell>SDH</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {result.mediaInfo.subtitleStreams.map((ss) => (
                                <TableRow key={ss.index}>
                                  <TableCell>{ss.index}</TableCell>
                                  <TableCell>{ss.codec}</TableCell>
                                  <TableCell>{ss.language ?? '-'}</TableCell>
                                  <TableCell>{ss.type ?? '-'}</TableCell>
                                  <TableCell>
                                    {ss.default ? 'Yes' : 'No'}
                                  </TableCell>
                                  <TableCell>
                                    {ss.forced ? 'Yes' : 'No'}
                                  </TableCell>
                                  <TableCell>{ss.sdh ? 'Yes' : 'No'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Stream Selection */}
            {result.streamSelection && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    <Trans>Stream Selection</Trans>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        <Trans>Profile</Trans>:{' '}
                        <strong>
                          {result.streamSelection.profileName ?? 'Legacy'}
                        </strong>
                      </Typography>
                    </Box>

                    {/* Rules Table */}
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              <Trans>Match</Trans>
                            </TableCell>
                            <TableCell>
                              <Trans>Label</Trans>
                            </TableCell>
                            <TableCell>
                              <Trans>Condition</Trans>
                            </TableCell>
                            <TableCell>
                              <Trans>Audio Action</Trans>
                            </TableCell>
                            <TableCell>
                              <Trans>Subtitle Action</Trans>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.streamSelection.rules.map((rule, i) => (
                            <TableRow
                              key={i}
                              sx={
                                rule.matched
                                  ? {
                                      bgcolor: 'success.main',
                                      '& td': { color: 'success.contrastText' },
                                    }
                                  : undefined
                              }
                            >
                              <TableCell>
                                {rule.matched ? (
                                  <CheckCircleOutline
                                    fontSize="small"
                                    color={rule.matched ? 'inherit' : 'success'}
                                  />
                                ) : (
                                  <ErrorOutline
                                    fontSize="small"
                                    color="disabled"
                                  />
                                )}
                              </TableCell>
                              <TableCell>{rule.label ?? '-'}</TableCell>
                              <TableCell>
                                <code>{rule.condition}</code>
                              </TableCell>
                              <TableCell>{rule.audioAction ?? '-'}</TableCell>
                              <TableCell>
                                {rule.subtitleAction ?? '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Selected Streams */}
                    <Box>
                      <Typography variant="subtitle2">
                        <Trans>Selected Audio</Trans>
                      </Typography>
                      {result.streamSelection.selectedAudioStream ? (
                        <Chip
                          label={`#${result.streamSelection.selectedAudioStream.index} ${result.streamSelection.selectedAudioStream.codec} ${result.streamSelection.selectedAudioStream.language ?? ''} ${result.streamSelection.selectedAudioStream.channels ?? ''}ch`}
                          color="primary"
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          <Trans>None</Trans>
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">
                        <Trans>Selected Subtitle</Trans>
                      </Typography>
                      {result.streamSelection.selectedSubtitleStream ? (
                        <Chip
                          label={`#${result.streamSelection.selectedSubtitleStream.index} ${result.streamSelection.selectedSubtitleStream.codec} ${result.streamSelection.selectedSubtitleStream.language ?? ''}`}
                          color="secondary"
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {result.streamSelection.subtitleReason ?? 'None'}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Transcode Config */}
            {result.transcodeConfig && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    <Trans>Transcode Config</Trans>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <strong>
                              <Trans>Name</Trans>
                            </strong>
                          </TableCell>
                          <TableCell>{result.transcodeConfig.name}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <strong>
                              <Trans>Video</Trans>
                            </strong>
                          </TableCell>
                          <TableCell>
                            {result.transcodeConfig.videoFormat} @{' '}
                            {resolutionToString(
                              result.transcodeConfig.resolution,
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <strong>
                              <Trans>Audio</Trans>
                            </strong>
                          </TableCell>
                          <TableCell>
                            {result.transcodeConfig.audioFormat}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <strong>
                              <Trans>HW Accel</Trans>
                            </strong>
                          </TableCell>
                          <TableCell>
                            {result.transcodeConfig.hardwareAccelerationMode}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Pipeline */}
            {result.pipeline && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    <Trans>Pipeline</Trans>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2">
                        <strong>
                          <Trans>Builder</Trans>
                        </strong>
                        : {result.pipeline.builderType} (
                        {result.pipeline.hardwareAccelMode})
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        <Trans>Pipeline Steps</Trans>
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                        }}
                      >
                        {result.pipeline.pipelineSteps.map((step, i) => (
                          <Chip key={i} label={step} size="small" />
                        ))}
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        <Trans>FFmpeg Command</Trans>
                      </Typography>
                      <CodeBlock text={result.pipeline.ffmpegArgsString} />
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Test Transcode Result */}
            {result.testTranscode && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    <Trans>Test Transcode</Trans>
                    {result.testTranscode.success ? (
                      <Chip
                        label="Success"
                        color="success"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    ) : (
                      <Chip
                        label={`Failed (${result.testTranscode.exitCode})`}
                        color="error"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {result.testTranscode.stderrOutput && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        FFmpeg stderr
                      </Typography>
                      <CodeBlock text={result.testTranscode.stderrOutput} />
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* FFmpeg Log */}
            {result.ffmpegLog && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    <Trans>FFmpeg Log</Trans>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <CodeBlock text={result.ffmpegLog} />
                </AccordionDetails>
              </Accordion>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
