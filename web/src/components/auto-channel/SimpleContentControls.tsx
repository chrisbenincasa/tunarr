import {
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ContentQuery } from '@tunarr/types/api';
import { getApiMediaSourcesOptions } from '@/generated/@tanstack/react-query.gen';
import { useMediaSourceLibraries } from '@/hooks/media-sources/useMediaSourceLibraries';

const ProgramTypes = ['movie', 'episode', 'track'] as const;

type ProgramType = (typeof ProgramTypes)[number];

const ProgramTypeLabels: Record<ProgramType, string> = {
  movie: 'Movies',
  episode: 'Episodes',
  track: 'Music',
};

type Props = {
  query: ContentQuery;
  onQueryChange: (query: ContentQuery) => void;
  compact?: boolean;
};

export function SimpleContentControls({
  query,
  onQueryChange,
  compact,
}: Props) {
  const { data: mediaSources } = useQuery(getApiMediaSourcesOptions());

  const selectedSourceId = query.mediaSourceIds?.[0];

  const { data: libraries } = useMediaSourceLibraries(selectedSourceId ?? '', {
    enabled: selectedSourceId !== undefined,
  });

  const handleSourceChange = (value: string) => {
    const sourceId = value || undefined;
    onQueryChange({
      ...query,
      mediaSourceIds: sourceId !== undefined ? [sourceId] : undefined,
      libraryIds: undefined,
    });
  };

  const handleLibraryChange = (value: string | string[]) => {
    const ids = typeof value === 'string' ? [value] : value;
    onQueryChange({
      ...query,
      libraryIds: ids.length > 0 ? ids : undefined,
    });
  };

  const handleProgramTypeToggle = (type: ProgramType) => {
    const current = query.programTypes ?? [];
    const exists = current.includes(type);
    const next = exists
      ? current.filter((t) => t !== type)
      : [...current, type];
    onQueryChange({
      ...query,
      programTypes: next.length > 0 ? next : undefined,
    });
  };

  const controlSize = compact ? 'small' : 'small';

  return (
    <Stack
      direction={compact ? 'row' : 'column'}
      spacing={compact ? 1.5 : 2}
      sx={{ flexWrap: compact ? 'wrap' : 'nowrap' }}
      alignItems={compact ? 'center' : 'flex-start'}
    >
      <FormControl size={controlSize} sx={{ minWidth: 180 }}>
        <InputLabel>Media Source</InputLabel>
        <Select
          value={selectedSourceId ?? ''}
          label="Media Source"
          onChange={(e) => handleSourceChange(e.target.value)}
        >
          <MenuItem value="">All Sources</MenuItem>
          {mediaSources?.map((source) => (
            <MenuItem key={source.id} value={source.id}>
              {source.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        size={controlSize}
        sx={{ minWidth: 180 }}
        disabled={selectedSourceId === undefined}
      >
        <InputLabel>Libraries</InputLabel>
        <Select
          multiple
          value={query.libraryIds ?? []}
          label="Libraries"
          onChange={(e) => handleLibraryChange(e.target.value)}
        >
          {libraries?.map((lib) => (
            <MenuItem key={lib.id} value={lib.id}>
              {lib.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ flexWrap: 'wrap' }}
      >
        {ProgramTypes.map((type) => {
          const isSelected = query.programTypes?.includes(type) ?? false;
          return (
            <Chip
              key={type}
              label={ProgramTypeLabels[type]}
              size={controlSize}
              variant={isSelected ? 'filled' : 'outlined'}
              color={isSelected ? 'primary' : 'default'}
              onClick={() => handleProgramTypeToggle(type)}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
