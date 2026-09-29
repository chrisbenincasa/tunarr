import { ProgramSearchAutocomplete } from '@/components/ProgramSearchAutocomplete';
import type { StreamSelectionProfileFormValues } from '@/components/profiles/streamSelectionFormTypes';
import { getChannelsOptions } from '@/generated/@tanstack/react-query.gen';
import { postApiStreamSelectionProfilesPreview } from '@/generated/sdk.gen';
import type {
  PostApiStreamSelectionProfilesPreviewData,
  PostApiStreamSelectionProfilesPreviewResponse,
} from '@/generated/types.gen';
import { getApiErrorMessage } from '@/helpers/apiError';
import {
  formatTerminalProgramTitle,
  terminalTypeFilter,
} from '@/helpers/programSearch';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
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
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ProgramOrFolder, TerminalProgram } from '@tunarr/types';
import { isTerminalItemType } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/schemas';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { create } from 'zustand';
import { RouterLink } from '../base/RouterLink.tsx';

type PreviewRules = PostApiStreamSelectionProfilesPreviewData['body']['rules'];
type PreviewResult = PostApiStreamSelectionProfilesPreviewResponse;
type AudioStreamInfo = PreviewResult['audioStreams'][number];
type SubtitleStreamInfo = PreviewResult['subtitleStreams'][number];

// Select can't hold undefined, so "no channel" is represented by this value.
const NoChannel = '';

// Remembers the last test target while moving between profiles. It resets on
// reload.
const usePreviewTarget = create<{
  program: TerminalProgram | null;
  channelId: string;
  setProgram: (program: TerminalProgram) => void;
  setChannelId: (channelId: string) => void;
}>((set) => ({
  program: null,
  channelId: NoChannel,
  setProgram: (program) => set({ program }),
  setChannelId: (channelId) => set({ channelId }),
}));

type Props = {
  // Returns the rules exactly as a save would send them.
  getRules: () => PreviewRules;
  // False while the rules fail form validation, which the API would reject.
  canRun: boolean;
};

export function StreamSelectionPreviewPanel({ getRules, canRun }: Props) {
  const { program, channelId, setProgram, setChannelId } = usePreviewTarget();
  const [searchQuery, setSearchQuery] = useState<SearchRequest>({
    query: '',
    filter: terminalTypeFilter,
    restrictSearchTo: ['title'],
  });
  const { data: channels } = useQuery(getChannelsOptions());

  // Serialized form rules at the time of the last run, to flag stale results.
  const [rulesAtRun, setRulesAtRun] = useState<string | null>(null);
  const currentRules = JSON.stringify(
    useWatch<StreamSelectionProfileFormValues, 'rules'>({ name: 'rules' }),
  );

  const previewMutation = useMutation({
    mutationFn: async (
      body: PostApiStreamSelectionProfilesPreviewData['body'],
    ) => {
      const { data } = await postApiStreamSelectionProfilesPreview({
        body,
        throwOnError: true,
      });
      return data;
    },
  });

  const includeProgram = useCallback(
    (item: ProgramOrFolder): item is TerminalProgram =>
      isTerminalItemType(item),
    [],
  );

  const handleRun = () => {
    if (!program) {
      return;
    }
    setRulesAtRun(currentRules);
    previewMutation.mutate({
      rules: getRules(),
      programId: program.uuid,
      channelId: channelId === NoChannel ? undefined : channelId,
    });
  };

  const result = previewMutation.data;
  const selectedChannel = channels?.find((ch) => ch.id === channelId);
  const isStale = result !== undefined && rulesAtRun !== currentRules;

  return (
    <Accordion disableGutters sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack>
          <Typography variant="h6">
            <Trans>Test</Trans>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Trans>
              Try these rules against a program, including unsaved changes.
            </Trans>
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <ProgramSearchAutocomplete<TerminalProgram>
            searchQuery={searchQuery}
            enabled={
              searchQuery.query !== undefined && searchQuery.query !== ''
            }
            value={program}
            includeItem={includeProgram}
            onChange={setProgram}
            onQueryChange={(q) => setSearchQuery({ ...searchQuery, query: q })}
            label={t`Search for a program`}
            renderOptionTitle={formatTerminalProgramTitle}
          />

          <FormControl fullWidth>
            <InputLabel>
              <Trans>Channel (optional)</Trans>
            </InputLabel>
            <Select
              value={channelId}
              label={t`Channel (optional)`}
              onChange={(e) => setChannelId(e.target.value)}
            >
              <MenuItem value={NoChannel}>
                <em>
                  <Trans>None</Trans>
                </em>
              </MenuItem>
              {channels?.map((ch) => (
                <MenuItem key={ch.id} value={ch.id}>
                  {ch.number} - {ch.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              <Trans>
                Supplies the channel name and number to rule conditions.
              </Trans>
            </FormHelperText>
          </FormControl>

          <Box>
            <Button
              type="button"
              variant="contained"
              startIcon={
                previewMutation.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <PlayArrow />
                )
              }
              disabled={!program || !canRun || previewMutation.isPending}
              onClick={handleRun}
            >
              <Trans>Run</Trans>
            </Button>
          </Box>

          {!canRun && (
            <Typography variant="body2" color="text.secondary">
              <Trans>Fix the errors in the rules above to run a test.</Trans>
            </Typography>
          )}

          {previewMutation.isError && (
            <Alert severity="error">
              {getApiErrorMessage(previewMutation.error) ??
                t`The test could not be run.`}
            </Alert>
          )}

          {result && !previewMutation.isPending && (
            <PreviewResults
              result={result}
              isStale={isStale}
              troubleshootLink={
                <TroubleshootLink
                  programId={result.program.uuid}
                  channelId={selectedChannel?.id}
                  channelName={selectedChannel?.name}
                />
              }
            />
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function PreviewResults({
  result,
  isStale,
  troubleshootLink,
}: {
  result: PreviewResult;
  isStale: boolean;
  troubleshootLink: ReactNode;
}) {
  const matched = result.matchedRuleIndex !== null;

  return (
    <Stack spacing={2}>
      {isStale && (
        <Alert severity="warning">
          <Trans>The rules changed since this test ran. Run it again.</Trans>
        </Alert>
      )}

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          <Trans>Rules</Trans>
        </Typography>
        <Stack spacing={1}>
          {result.rules.map((rule, idx) => {
            const applied = idx === result.matchedRuleIndex;
            return (
              <Stack
                key={idx}
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{
                  p: 1,
                  borderRadius: 1,
                  border: 1,
                  borderColor: applied ? 'primary.main' : 'divider',
                  bgcolor: applied ? 'action.selected' : undefined,
                }}
              >
                {rule.matched ? (
                  <CheckCircleOutline color="success" fontSize="small" />
                ) : (
                  <CancelOutlined color="disabled" fontSize="small" />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2">
                    {rule.label ?? t`Rule ${idx + 1}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                  >
                    {rule.condition}
                  </Typography>
                  {rule.error && (
                    <Typography variant="caption" color="error" display="block">
                      <Trans>Invalid condition: {rule.error}</Trans>
                    </Typography>
                  )}
                </Box>
                {applied && (
                  <Chip size="small" color="primary" label={t`Applied`} />
                )}
              </Stack>
            );
          })}
        </Stack>
      </Box>

      {matched ? (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            <Trans>Selected streams</Trans>
          </Typography>
          <Typography variant="body2">
            <Trans>Audio:</Trans>{' '}
            {result.selectedAudioStream
              ? describeAudio(result.selectedAudioStream)
              : t`None (the program has no audio streams)`}
          </Typography>
          <Typography variant="body2">
            <Trans>Subtitles:</Trans>{' '}
            {result.selectedSubtitleStream
              ? describeSubtitle(result.selectedSubtitleStream)
              : t`None`}
          </Typography>
        </Box>
      ) : (
        <Alert severity="info">
          <Trans>
            No rule matched. On a real stream, Tunarr would move on to the next
            profile: the source, then the channel, then the default profile,
            then the built-in profile.
          </Trans>
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary">
        <Trans>
          {result.audioStreams.length} audio and {result.subtitleStreams.length}{' '}
          subtitle streams available in {result.program.title}.
        </Trans>
      </Typography>

      <Box>{troubleshootLink}</Box>
    </Stack>
  );
}

function TroubleshootLink({
  programId,
  channelId,
  channelName,
}: {
  programId: string;
  channelId?: string;
  channelName?: string;
}) {
  return (
    <RouterLink
      to="/system/troubleshoot"
      search={{ programId, channelId }}
      variant="body2"
    >
      {channelName ? (
        <Trans>Troubleshoot on channel {channelName}</Trans>
      ) : (
        <Trans>Open in Troubleshoot</Trans>
      )}
    </RouterLink>
  );
}

function describeAudio(stream: AudioStreamInfo): string {
  return [
    `#${stream.index}`,
    stream.language,
    stream.codec,
    stream.channels !== undefined ? t`${stream.channels} ch` : undefined,
    stream.title,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
}

function describeSubtitle(stream: SubtitleStreamInfo): string {
  return [
    `#${stream.index}`,
    stream.language,
    stream.codec,
    stream.type === 'external' ? t`external` : undefined,
    stream.forced ? t`forced` : undefined,
    stream.title,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
}
