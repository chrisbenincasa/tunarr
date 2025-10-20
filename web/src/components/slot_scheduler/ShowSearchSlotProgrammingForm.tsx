import { createTypeSearchField } from '@tunarr/shared/util';
import { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { CommonShowSlotViewModel } from '../../model/CommonSlotModels.ts';
import { ProgramSearchAutocomplete } from '../ProgramSearchAutocomplete.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

export const ShowSearchSlotProgrammingForm = () => {
  const { control, setValue, watch } =
    useFormContext<CommonShowSlotViewModel>();
  const [searchQuery, setSearchQuery] = useState('');
  const enabled = useMemo(() => searchQuery.length >= 1, [searchQuery]);
  const show = watch('show');

  const search = useMemo(
    () => ({
      query: searchQuery,
      filter: createTypeSearchField('show'),
      restrictSearchTo: ['title'],
    }),
    [searchQuery],
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
            }}
            onQueryChange={setSearchQuery}
            label="Show"
          />
        )}
      />
      <SlotOrderFormControl />
    </>
  );
};
