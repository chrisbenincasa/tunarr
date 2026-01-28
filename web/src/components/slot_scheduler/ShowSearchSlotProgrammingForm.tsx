import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createTypeSearchField } from '@tunarr/shared/util';
import type { Season, Show } from '@tunarr/types';
import { useMemo, useState } from 'react';
import { getApiProgramsByIdChildrenOptions } from '../../generated/@tanstack/react-query.gen.ts';
import type { Nullable } from '../../types/util.ts';
import { ProgramSearchAutocomplete } from '../ProgramSearchAutocomplete.tsx';

type ShowSubset = {
  showId: string;
  show: Nullable<Show>;
  seasonFilter: number[];
};

type Props = {
  show: Nullable<Show>;
  seasonFilter: number[];
  onShowChange: (show: Show) => void;
  onSeasonFilterChange: (seasons: Season[]) => void;
};

export const ShowSearchSlotProgrammingForm = ({
  show,
  seasonFilter,
  onShowChange,
  onSeasonFilterChange,
}: Props) => {
  // const { control, setValue, watch } = useFormContext<ShowSubset>();
  const [searchQuery, setSearchQuery] = useState('');
  const enabled = useMemo(() => searchQuery.length >= 1, [searchQuery]);
  // const show = watch('show');

  const search = useMemo(
    () => ({
      query: searchQuery,
      filter: createTypeSearchField('show'),
      restrictSearchTo: ['title'],
    }),
    [searchQuery],
  );

  const showChildrenQuery = useQuery({
    ...getApiProgramsByIdChildrenOptions({
      path: { id: show?.uuid ?? '' },
    }),
    enabled: !!show,
  });

  const seasonAutocompleteOpts = useMemo(
    () =>
      showChildrenQuery.data?.result.programs.filter(
        (x) => x.type === 'season',
      ) ?? [],
    [showChildrenQuery.data],
  );

  return (
    <>
      {/* <Controller
        control={control}
        name="showId"
        rules={{ required: true }}
        render={({ field }) => (
        )}
      /> */}
      <ProgramSearchAutocomplete
        value={show}
        searchQuery={search}
        enabled={enabled}
        includeItem={(item) => item.type === 'show'}
        onChange={(show) => {
          onShowChange(show);
          // field.onChange(show.uuid);
          // setValue('show', show);
          // setValue('seasonFilter', []);
        }}
        onQueryChange={setSearchQuery}
        label="Show"
      />
      {/* <Controller
        control={control}
        name="seasonFilter"
        render={({ field }) => (
        )}
      /> */}
      <Autocomplete
        options={seasonAutocompleteOpts}
        value={
          seasonFilter.length === 0
            ? []
            : seasonAutocompleteOpts.filter((opt) =>
                seasonFilter.includes(opt.index),
              )
        }
        disabled={!show || showChildrenQuery.isLoading}
        multiple
        getOptionKey={(season) => season.index}
        getOptionLabel={(season) => season.title}
        renderInput={(params) => (
          <TextField
            {...params}
            label={'Seasons'}
            disabled={!show || showChildrenQuery.isLoading}
            helperText="Optionally schedule only specific seasons of the selected show"
          />
        )}
        onChange={
          (_, seasons) => onSeasonFilterChange(seasons)
          // setValue(
          //   'seasonFilter',
          //   seasons.map((s) => s.index),
          // )
        }
        filterSelectedOptions
      />
    </>
  );
};
