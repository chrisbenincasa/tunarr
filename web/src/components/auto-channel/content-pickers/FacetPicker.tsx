import { Segmented } from '@/components/ui/Segmented';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { search } from '@tunarr/shared/util';
import type { SearchFilter } from '@tunarr/types/schemas';
import { capitalize } from 'lodash-es';
import type { HTMLAttributes } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { postApiProgramsFacetsByFacetName } from '../../../generated/sdk.gen.ts';

type FacetValue = { label: string; count: number };

// Episodes carry these values only on their show, so match the show's field too.
const ShowLevelField: Partial<Record<string, string>> = {
  genre: 'show_genre',
  studio: 'show_studio',
};

function fieldFilter(field: string, values: string[]): SearchFilter {
  return {
    type: 'value',
    fieldSpec: {
      key: search.virtualFieldToIndexField[field] ?? field,
      name: field,
      op: values.length === 1 ? '=' : 'in',
      type: 'faceted_string',
      value: values,
    },
  };
}

type Props = {
  facetFields: string[];
  label: string;
  field: string | undefined;
  value: string[];
  onChange: (values: string[], filterString: string, field: string) => void;
  mediaSourceId?: string;
  libraryId?: string;
};

export function FacetPicker({
  facetFields,
  label,
  field,
  value,
  onChange,
  mediaSourceId,
  libraryId,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<FacetValue[]>([]);

  const activeField =
    field !== undefined && facetFields.includes(field) ? field : facetFields[0];
  const indexField =
    search.virtualFieldToIndexField[activeField] ?? activeField;

  const fetchFacets = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await postApiProgramsFacetsByFacetName({
        path: { facetName: indexField },
        query: {
          facetQuery: query || undefined,
          mediaSourceId,
          libraryId,
        },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data?.facetValues) {
        const facetValues = Object.entries(data.facetValues).map(
          ([name, count]) => ({
            label: name,
            count,
          }),
        );
        facetValues.sort((a, b) => b.count - a.count);
        setOptions(facetValues);
      }
    },
  });

  // Fetch facets on mount and when context changes
  useEffect(() => {
    fetchFacets.mutate('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexField, mediaSourceId, libraryId]);

  const handleInputChange = useCallback(
    (_: unknown, newInputValue: string) => {
      setInputValue(newInputValue);
      fetchFacets.mutate(newInputValue);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indexField, mediaSourceId, libraryId],
  );

  const buildFilterString = useCallback(
    (selected: string[]) => {
      if (selected.length === 0) return '';
      const filter = fieldFilter(activeField, selected);
      const showField = ShowLevelField[activeField];
      return search.searchFilterToString(
        showField === undefined
          ? filter
          : {
              type: 'op',
              op: 'or',
              children: [filter, fieldFilter(showField, selected)],
            },
      );
    },
    [activeField],
  );

  const handleChange = useCallback(
    (_: unknown, newValue: (string | FacetValue)[]) => {
      const selected = newValue.map((v) =>
        typeof v === 'string' ? v : v.label,
      );
      onChange(selected, buildFilterString(selected), activeField);
    },
    [onChange, buildFilterString, activeField],
  );

  return (
    <>
      {facetFields.length > 1 && (
        <Box sx={{ mb: 1 }}>
          <Segmented
            aria-label="Facet field"
            options={facetFields.map((field) => ({
              value: field,
              label: capitalize(field),
            }))}
            value={activeField}
            onChange={(nextField) => {
              // A pick on one field doesn't apply to another, so clear it.
              onChange([], '', nextField);
            }}
          />
        </Box>
      )}
      <Autocomplete
        multiple
        freeSolo
        options={options}
        value={value.map(
          (v) => options.find((o) => o.label === v) ?? { label: v, count: 0 },
        )}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleChange}
        getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
        isOptionEqualToValue={(opt, val) => opt.label === val.label}
        renderOption={(
          { key, ...props }: HTMLAttributes<HTMLLIElement> & { key: string },
          option,
        ) => (
          <li key={key} {...props}>
            <Typography sx={{ flexGrow: 1 }}>
              {typeof option === 'string' ? option : option.label}
            </Typography>
            {typeof option !== 'string' && (
              <Typography variant="caption" color="text.secondary">
                {option.count}
              </Typography>
            )}
          </li>
        )}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => {
            const { key, ...chipProps } = getTagProps({ index });
            const opt = typeof option === 'string' ? option : option.label;
            const count = typeof option === 'string' ? 0 : option.count;
            return (
              <Chip
                key={key}
                label={count > 0 ? `${opt} (${count})` : opt}
                size="small"
                color={count === 0 && value.length > 0 ? 'warning' : 'default'}
                {...chipProps}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={`Search ${activeField}s...`}
            size="small"
          />
        )}
        loading={fetchFacets.isPending}
        sx={{ mt: 1 }}
      />
    </>
  );
}
