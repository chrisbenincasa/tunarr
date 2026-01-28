import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { MediaSourceId } from '@tunarr/shared';
import { search } from '@tunarr/shared/util';
import type { FactedStringSearchField } from '@tunarr/types/schemas';
import { isArray } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useDebounceValue } from 'usehooks-ts';
import { postApiProgramsFacetsByFacetNameOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import type { FieldKey, FieldPrefix } from '../../types/SearchBuilder.ts';
import type { SearchForm } from './SearchInput.tsx';

export function FacetStringValueSearchNode({
  formKey,
  mediaSourceId,
  libraryId,
  field,
}: {
  field: FactedStringSearchField;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
  mediaSourceId?: MediaSourceId;
  libraryId?: string;
}) {
  const { control, setValue, watch } = useFormContext<SearchForm>();
  const [facetSearchInputValue, setFacetSearchInputValue] = useDebounceValue(
    '',
    500,
  );
  const [lastValue, op] = watch([`${formKey}.value`, `${formKey}.op`]);

  const facetQuery = useQuery({
    ...postApiProgramsFacetsByFacetNameOptions({
      path: {
        facetName: search.virtualFieldToIndexField[field.key] ?? field.key,
      },
      query: {
        mediaSourceId,
        libraryId,
        facetQuery: isNonEmptyString(facetSearchInputValue)
          ? facetSearchInputValue
          : undefined,
      },
      body: {},
    }),
  });

  const options = useMemo(() => {
    return facetQuery.data?.facetValues
      ? Object.keys(facetQuery.data.facetValues)
      : [];
  }, [facetQuery.data]);

  const handleValueChange = useCallback(
    (newValue: string[], originalOnChange: (...args: unknown[]) => void) => {
      if (
        (!isArray(lastValue) || lastValue.length < 2) &&
        newValue.length > 1 &&
        op !== 'in' &&
        op !== 'not in'
      ) {
        setValue(`${formKey}.op`, 'in', {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
      originalOnChange([...newValue]);
    },
    [formKey, lastValue, op, setValue],
  );

  return (
    <Controller
      control={control}
      name={`${formKey}.value`}
      render={({ field }) => {
        return (
          <Autocomplete
            size="small"
            value={field.value as string[]}
            options={options}
            loading={facetQuery.isLoading}
            multiple
            filterOptions={(x) => x}
            onChange={(_, newValue) => {
              handleValueChange(newValue, field.onChange);
            }}
            filterSelectedOptions
            autoComplete
            onInputChange={(_, newInputValue) => {
              setFacetSearchInputValue(newInputValue);
            }}
            sx={{ minWidth: 200 }}
            renderInput={(params) => (
              <TextField
                label="Value"
                {...params}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {facetQuery.isLoading || facetQuery.isRefetching ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        );
      }}
    />
  );
}
