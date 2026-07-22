import { Autocomplete, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { postApiProgramsSearch } from '../../../generated/sdk.gen.ts';

type ShowOption = {
  id: string;
  title: string;
  year: number | null;
};

type Props = {
  value: ShowOption | null;
  onChange: (show: ShowOption | null) => void;
  mediaSourceId?: string;
  libraryId?: string;
};

export function SingleShowPicker({
  value,
  onChange,
  mediaSourceId,
  libraryId,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<ShowOption[]>([]);

  const searchShows = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await postApiProgramsSearch({
        body: {
          query: {
            query: query || undefined,
            filter: {
              type: 'value',
              fieldSpec: {
                key: 'type',
                name: 'Type',
                op: '=',
                type: 'string',
                value: ['show'],
              },
            },
          },
          mediaSourceId,
          libraryId,
          page: 1,
          limit: 20,
        },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data?.results) {
        const shows: ShowOption[] = [];
        for (const r of data.results) {
          if ('uuid' in r && 'title' in r && 'type' in r && r.type === 'show') {
            shows.push({
              id: r.uuid,
              title: r.title,
              year: null,
            });
          }
        }
        setOptions(shows);
      }
    },
  });

  const handleInputChange = useCallback(
    (_: unknown, newInputValue: string) => {
      setInputValue(newInputValue);
      if (newInputValue.length >= 2) {
        searchShows.mutate(newInputValue);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaSourceId, libraryId],
  );

  return (
    <Autocomplete
      options={options}
      value={value}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={(_, newValue) => onChange(newValue)}
      getOptionLabel={(opt) =>
        opt.year ? `${opt.title} (${opt.year})` : opt.title
      }
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      renderOption={({ key, ...props }, option) => (
        <li key={key} {...props}>
          <Typography>{option.title}</Typography>
          {option.year && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              ({option.year})
            </Typography>
          )}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search for a show"
          placeholder="Type at least 2 characters..."
          size="small"
        />
      )}
      loading={searchShows.isPending}
      noOptionsText={
        inputValue.length < 2 ? 'Type to search...' : 'No shows found'
      }
      sx={{ mt: 1 }}
    />
  );
}
