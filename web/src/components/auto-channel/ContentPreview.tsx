import { programTypeCounts } from '@/components/auto-channel/programTypeCounts';
import { MonoText } from '@/components/ui/MonoText';
import {
  Alert,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import type { ContentPreviewResponse } from '@tunarr/types/api';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

type ContentPreviewProps = {
  preview: ContentPreviewResponse | undefined;
  isLoading: boolean;
  error: Error | null;
};

function formatDuration(ms: number): string {
  const dur = dayjs.duration(ms);
  const days = Math.floor(dur.asDays());
  const hours = dur.hours();
  const minutes = dur.minutes();
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

export function ContentPreview({
  preview,
  isLoading,
  error,
}: ContentPreviewProps) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to preview content: {error.message}
      </Alert>
    );
  }

  if (!preview) {
    return null;
  }

  if (preview.totalPrograms === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        No content found matching the query. Try broadening your search or
        checking your media sources.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography>
          <MonoText fontWeight={600}>
            {preview.totalPrograms.toLocaleString()}
          </MonoText>{' '}
          programs
        </Typography>
        <Typography>
          <MonoText fontWeight={600}>
            {formatDuration(preview.totalDurationMs)}
          </MonoText>{' '}
          total
        </Typography>
        {programTypeCounts(preview.byType).map(({ type, count, noun }) => (
          <Typography key={type} color="text.secondary">
            <MonoText>{count.toLocaleString()}</MonoText> {noun}
          </Typography>
        ))}
      </Stack>

      {preview.topShows.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Top Shows
          </Typography>
          <List dense disablePadding>
            {preview.topShows.slice(0, 5).map((show) => (
              <ListItem key={show.name} disableGutters>
                <ListItemText
                  primary={show.name}
                  secondary={
                    <>
                      <MonoText>{show.episodeCount}</MonoText> episodes
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
