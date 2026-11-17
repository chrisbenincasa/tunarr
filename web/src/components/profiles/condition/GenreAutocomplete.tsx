import { postApiProgramsFacetsByFacetNameOptions } from '@/generated/@tanstack/react-query.gen.ts';
import { isNonEmptyString } from '@/helpers/util.ts';
import { t } from '@lingui/core/macro';
import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { search } from '@tunarr/shared/util';
import { useMemo } from 'react';
import { useDebounceValue } from 'usehooks-ts';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

// Suggests genre names from the search index. Free text is allowed because a
// rule can target a genre that no scanned program has yet.
export function GenreAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useDebounceValue('', 300);

  const facetQuery = useQuery({
    ...postApiProgramsFacetsByFacetNameOptions({
      path: { facetName: search.virtualFieldToIndexField['genre'] ?? 'genre' },
      query: { facetQuery: isNonEmptyString(query) ? query : undefined },
      body: {},
    }),
  });

  const options = useMemo(
    () => Object.keys(facetQuery.data?.facetValues ?? {}).sort(),
    [facetQuery.data],
  );

  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      loading={facetQuery.isLoading}
      value={value}
      inputValue={value}
      onChange={(_, newValue) => onChange(newValue ?? '')}
      onInputChange={(_, newValue, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setQuery(newValue);
          onChange(newValue);
        }
      }}
      renderInput={(params) => <TextField {...params} label={t`Genre`} />}
      sx={{ minWidth: 200 }}
    />
  );
}
