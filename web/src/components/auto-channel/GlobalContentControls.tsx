import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getApiMediaSourcesOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { useMediaSourceLibraries } from '../../hooks/media-sources/useMediaSourceLibraries.ts';

export type GlobalContentContext = {
  mediaSourceId?: string;
  libraryIds?: string[];
};

type Props = {
  context: GlobalContentContext;
  onContextChange: (ctx: GlobalContentContext) => void;
};

export function GlobalContentControls({ context, onContextChange }: Props) {
  const { data: mediaSources } = useQuery(getApiMediaSourcesOptions());

  const { data: libraries } = useMediaSourceLibraries(
    context.mediaSourceId ?? '',
    { enabled: context.mediaSourceId !== undefined },
  );

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary">
        Content Source
      </Typography>
      <Stack direction="row" spacing={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Media Source</InputLabel>
          <Select
            value={context.mediaSourceId ?? ''}
            label="Media Source"
            onChange={(e) => {
              const val = e.target.value || undefined;
              onContextChange({
                mediaSourceId: val,
                libraryIds: undefined,
              });
            }}
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
          size="small"
          sx={{ minWidth: 200 }}
          disabled={!context.mediaSourceId}
        >
          <InputLabel>Library</InputLabel>
          <Select
            multiple
            value={context.libraryIds ?? []}
            label="Library"
            onChange={(e) => {
              const val = e.target.value;
              const ids = typeof val === 'string' ? [val] : val;
              onContextChange({
                ...context,
                libraryIds: ids.length > 0 ? ids : undefined,
              });
            }}
          >
            {libraries?.map((lib) => (
              <MenuItem key={lib.id} value={lib.id}>
                {lib.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}
