import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createTypeSearchField } from '@tunarr/shared/util';
import { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { getApiProgramsByIdChildrenOptions } from '../../generated/@tanstack/react-query.gen.ts';
import type { CommonShowSlotViewModel } from '../../model/CommonSlotModels.ts';
import { ProgramSearchAutocomplete } from '../ProgramSearchAutocomplete.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

export const ShowSearchSlotProgrammingForm = () => {
  const { control, setValue, watch } =
    useFormContext<CommonShowSlotViewModel>();
  const [searchQuery, setSearchQuery] = useState('');
  const enabled = useMemo(() => searchQuery.length >= 1, [searchQuery]);
  const show = watch('show');
  console.log(watch());

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
      <Controller
        control={control}
        name="showId"
        rules={{ required: true }}
        render={({ field }) => (
          <ProgramSearchAutocomplete
            value={show}
            searchQuery={search}
            enabled={enabled}
            includeItem={(item) => item.type === 'show'}
            onChange={(show) => {
              field.onChange(show.uuid);
              setValue('show', show);
              setValue('seasonFilter', []);
            }}
            onQueryChange={setSearchQuery}
            label="Show"
          />
        )}
      />
      <Controller
        control={control}
        name="seasonFilter"
        render={({ field }) => (
          <Autocomplete
            options={seasonAutocompleteOpts}
            value={
              field.value.length === 0
                ? []
                : seasonAutocompleteOpts.filter((opt) =>
                    field.value.includes(opt.index),
                  )
            }
            disabled={!show || showChildrenQuery.isLoading}
            multiple
            getOptionKey={(season) => season.index}
            getOptionLabel={(season) => season.title}
            renderInput={(params) => (
              <TextField {...params} label={'Seasons'} />
            )}
            onChange={(_, seasons) =>
              setValue(
                'seasonFilter',
                seasons.map((s) => s.index),
              )
            }
            filterSelectedOptions
          />
        )}
      />
      <SlotOrderFormControl />
    </>
  );
};
