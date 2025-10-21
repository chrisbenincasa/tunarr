import { Autocomplete, ListItem, TextField } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createTypeSearchField } from '@tunarr/shared/util';
import type { Show } from '@tunarr/types';
import { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useIntersectionObserver } from 'usehooks-ts';
import { postApiProgramsSearchInfiniteOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';
import type { UIShowProgrammingTimeSlot } from './SlotTypes.ts';

type Opt = Show | { type: 'sentinel' };

export const ShowSearchSlotProgrammingForm = () => {
  const { control, setValue } = useFormContext<UIShowProgrammingTimeSlot>();
  const [searchQuery, setSearchQuery] = useState('');
  const enabled = useMemo(() => searchQuery.length >= 1, [searchQuery]);

  const results = useInfiniteQuery({
    ...postApiProgramsSearchInfiniteOptions({
      body: {
        query: {
          query: searchQuery,
          filter: createTypeSearchField('show'),
          restrictSearchTo: ['title'],
        },
      },
    }),
    getNextPageParam: (last) => {
      const nextPage = last.page + 1;
      // We can't always trust the total hits. Meilisearch
      // by default maxes out at 1000. You can configure this
      // but it makes search slow. We just keep querying until
      // there are no more results!
      if (last.totalHits < 1_000 && nextPage > last.totalPages) {
        return;
      } else if (last.totalHits >= 1_000 && last.results.length === 0) {
        return;
      }

      return nextPage;
    },
    getPreviousPageParam: (last) => {
      const prevPage = last.page - 1;
      if (prevPage <= 0) {
        return;
      }
      return prevPage;
    },
    initialPageParam: 1,
    staleTime: 0,
    enabled,
  });

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting && results.hasNextPage && !results.isLoading) {
        results.fetchNextPage().catch(console.error);
      }
    },
    threshold: 0.5,
  });

  const options = useMemo(() => {
    const realOpts: Opt[] = (
      results.data?.pages.flatMap((page) => page.results) ?? []
    ).filter((result) => result.type === 'show');
    if (enabled && realOpts.length > 0 && results.hasNextPage) {
      realOpts.push({ type: 'sentinel' });
    }
    return realOpts;
  }, [enabled, results.data?.pages, results.hasNextPage]);

  return (
    <>
      <Controller
        control={control}
        name="showId"
        rules={{ required: true }}
        render={({ field }) => (
          <Autocomplete
            options={options}
            getOptionLabel={(value) =>
              value.type === 'sentinel' ? 'Loading...' : value.title
            }
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
                field.onChange(value.uuid);
                setValue('show', value);
              }
            }}
            renderInput={(params) => <TextField {...params} label="Program" />}
            autoComplete
            onInputChange={(_, newInputValue) => {
              setSearchQuery(newInputValue);
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
        )}
      />
      <SlotOrderFormControl />
    </>
  );
};
