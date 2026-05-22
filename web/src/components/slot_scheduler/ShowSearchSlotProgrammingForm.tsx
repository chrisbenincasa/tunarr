import { useLingui } from '@lingui/react/macro';
import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createTypeSearchField } from '@tunarr/shared/util';
import { useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { getApiProgramsByIdChildrenOptions } from '../../generated/@tanstack/react-query.gen.ts';
import type { CommonShowSlotViewModel } from '../../model/CommonSlotModels.ts';
import { ProgramSearchAutocomplete } from '../ProgramSearchAutocomplete.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

export const ShowSearchSlotProgrammingForm = () => {
  const { t } = useLingui();
  const { control, setValue } = useFormContext<CommonShowSlotViewModel>();
  const [searchQuery, setSearchQuery] = useState('');
  const enabled = useMemo(() => searchQuery.length >= 1, [searchQuery]);
  const [show, seasonFilter, seasonExcludeFilter] = useWatch({
    control: control,
    name: ['show', 'seasonFilter', 'seasonExcludeFilter'],
  });

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

  const allSeasons = useMemo(
    () =>
      showChildrenQuery.data?.result.programs.filter(
        (x) => x.type === 'season',
      ) ?? [],
    [showChildrenQuery.data],
  );

  const includeOptions = useMemo(
    () => allSeasons.filter((s) => !seasonExcludeFilter.includes(s.index)),
    [allSeasons, seasonExcludeFilter],
  );

  const excludeOptions = useMemo(
    () => allSeasons.filter((s) => !seasonFilter.includes(s.index)),
    [allSeasons, seasonFilter],
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
              setValue('seasonExcludeFilter', []);
            }}
            onQueryChange={setSearchQuery}
            label={t`Show`}
          />
        )}
      />
      <Controller
        control={control}
        name="seasonFilter"
        render={({ field }) => (
          <Autocomplete
            options={includeOptions}
            value={
              field.value.length === 0
                ? []
                : allSeasons.filter((opt) => field.value.includes(opt.index))
            }
            disabled={!show || showChildrenQuery.isLoading}
            multiple
            getOptionKey={(season) => season.index}
            getOptionLabel={(season) => season.title}
            renderInput={(params) => (
              <TextField {...params} label={t`Include Seasons`} />
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
      <Controller
        control={control}
        name="seasonExcludeFilter"
        render={({ field }) => (
          <Autocomplete
            options={excludeOptions}
            value={
              field.value.length === 0
                ? []
                : allSeasons.filter((opt) => field.value.includes(opt.index))
            }
            disabled={!show || showChildrenQuery.isLoading}
            multiple
            getOptionKey={(season) => season.index}
            getOptionLabel={(season) => season.title}
            renderInput={(params) => (
              <TextField {...params} label={t`Exclude Seasons`} />
            )}
            onChange={(_, seasons) =>
              setValue(
                'seasonExcludeFilter',
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
