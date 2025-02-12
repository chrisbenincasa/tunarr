import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { MediaSourceLibrary } from '@tunarr/types';
import type { FactedStringSearchField, SearchRequest } from '@tunarr/types/api';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useDebounceValue } from 'usehooks-ts';
import { postApiProgramsFacetsByFacetNameOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import type { FieldKey, FieldPrefix } from '../../types/SearchBuilder.ts';

export function FacetStringValueSearchNode({
  formKey,
  library,
  field,
}: {
  field: FactedStringSearchField;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
  library?: MediaSourceLibrary;
}) {
  const { control } = useFormContext<SearchRequest>();
  const [facetSearchInputValue, setFacetSearchInputValue] = useDebounceValue(
    '',
    500,
  );

  const facetQuery = useQuery({
    ...postApiProgramsFacetsByFacetNameOptions({
      path: { facetName: field.key },
      query: {
        libraryId: library?.id,
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
  }, [facetQuery.data?.facetValues]);

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
              field.onChange([...newValue.values()]);
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
