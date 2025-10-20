import { Autocomplete, ListItem, TextField } from '@mui/material';
import type { ProgramOrFolder } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { isUndefined } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { useProgramInfiniteSearch } from '../hooks/useProgramInfiniteSearch.ts';

type Props<ProgramT extends ProgramOrFolder> = {
  searchQuery: SearchRequest;
  enabled: boolean;
  value: ProgramT | null | undefined;
  includeItem: (result: ProgramOrFolder) => result is ProgramT;
  onChange: (value: ProgramT) => void;
  onQueryChange: (value: string) => void;
  label?: string;
};

type AutocompleteOpt<ProgramT extends ProgramOrFolder> =
  | ProgramT
  | { type: 'sentinel' };

export const ProgramSearchAutocomplete = <ProgramT extends ProgramOrFolder>({
  searchQuery,
  enabled,
  includeItem,
  value,
  onChange,
  onQueryChange,
  label = 'Program',
}: Props<ProgramT>) => {
  const results = useProgramInfiniteSearch(searchQuery, enabled);

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting && results.hasNextPage && !results.isLoading) {
        results.fetchNextPage().catch(console.error);
      }
    },
    threshold: 0.5,
  });

  const options = useMemo(() => {
    if (
      (results.isLoading && isUndefined(results.data)) ||
      results.data?.pages.length === 0
    ) {
      return [{ type: 'sentinel' }] satisfies AutocompleteOpt<ProgramT>[];
    }
    const realOpts: AutocompleteOpt<ProgramT>[] = (
      results.data?.pages.flatMap((page) => page.results) ?? []
    ).filter(includeItem);

    if (enabled && realOpts.length > 0 && results.hasNextPage) {
      realOpts.push({ type: 'sentinel' });
    }
    return realOpts;
  }, [enabled, includeItem, results]);

  const optionEqualToValue = useCallback(
    (opt: AutocompleteOpt<ProgramT>, value: AutocompleteOpt<ProgramT>) => {
      if (opt.type === 'sentinel' && value.type === 'sentinel') {
        return true;
      }

      if (opt.type === 'sentinel' || value.type === 'sentinel') {
        return false;
      }

      if (opt.type === value.type) {
        return opt.uuid === value.uuid;
      }

      return false;
    },
    [],
  );

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(value) =>
        value.type === 'sentinel' ? 'Loading...' : value.title
      }
      value={value}
      isOptionEqualToValue={optionEqualToValue}
      noOptionsText="Search for shows"
      renderOption={(optProps, opt) => {
        if (opt.type === 'sentinel') {
          return (
            <ListItem id="sentinel" ref={ref}>
              Loading&hellip;
            </ListItem>
          );
        }
        return <ListItem {...optProps}>{opt.title}</ListItem>;
      }}
      onChange={(_, value) => {
        if (value && value.type !== 'sentinel') {
          onChange(value);
        }
      }}
      renderInput={(params) => <TextField {...params} label={label} />}
      autoComplete
      onInputChange={(_, newInputValue) => {
        onQueryChange(newInputValue);
      }}
      getOptionDisabled={(opt) => opt.type === 'sentinel'}
      slotProps={{
        listbox: {
          sx: {
            maxHeight: '200px',
          },
        },
      }}
    />
  );
};
