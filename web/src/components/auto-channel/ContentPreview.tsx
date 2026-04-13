import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
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
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Chip
          label={`${preview.totalPrograms} programs`}
          color="primary"
          variant="outlined"
        />
        <Chip
          label={`Total: ${formatDuration(preview.totalDurationMs)}`}
          variant="outlined"
        />
        {Object.entries(preview.byType).map(([type, count]) => (
          <Chip
            key={type}
            label={`${count} ${type}${count !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
          />
        ))}
      </Box>

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
                  secondary={`${show.episodeCount} episodes`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
