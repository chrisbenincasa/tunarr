import { getApiMediaSourcesOptions } from '@/generated/@tanstack/react-query.gen.ts';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

type Props = {
  value: string;
  onChange: (libraryId: string) => void;
};

export function LibrarySelect({ value, onChange }: Props) {
  const { data: mediaSources, isLoading } = useQuery(
    getApiMediaSourcesOptions(),
  );

  const known =
    mediaSources?.some((source) =>
      source.libraries.some((library) => library.id === value),
    ) ?? false;

  // Select children must be a flat list for ListSubheader to work.
  const items = (mediaSources ?? []).flatMap((source) => [
    <ListSubheader key={`source-${source.id}`}>{source.name}</ListSubheader>,
    ...source.libraries.map((library) => (
      <MenuItem key={library.id} value={library.id}>
        {library.name}
      </MenuItem>
    )),
  ]);

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel>
        <Trans>Library</Trans>
      </InputLabel>
      <Select
        value={isLoading ? '' : value}
        label={t`Library`}
        onChange={(e) => onChange(e.target.value)}
      >
        {!isLoading && value !== '' && !known && (
          <MenuItem value={value}>
            <em>
              <Trans>Unknown library</Trans>
            </em>
          </MenuItem>
        )}
        {items}
      </Select>
    </FormControl>
  );
}
