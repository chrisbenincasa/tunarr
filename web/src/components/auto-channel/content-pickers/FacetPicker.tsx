import {
  Autocomplete,
  Chip,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { search } from '@tunarr/shared/util';
import { useCallback, useEffect, useState } from 'react';
import { postApiProgramsFacetsByFacetName } from '../../../generated/sdk.gen.ts';

type FacetValue = { label: string; count: number };

type Props = {
  facetFields: string[];
  label: string;
  value: string[];
  onChange: (values: string[], filterString: string) => void;
  mediaSourceId?: string;
  libraryId?: string;
};

export function FacetPicker({
  facetFields,
  label,
  value,
  onChange,
  mediaSourceId,
  libraryId,
}: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<FacetValue[]>([]);

  const activeField = facetFields[activeTab] ?? facetFields[0];
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
      if (selected.length === 1) {
        return `${activeField} = "${selected[0]}"`;
      }
      const quoted = selected.map((v) => `"${v}"`).join(', ');
      return `${activeField} in (${quoted})`;
    },
    [activeField],
  );

  const handleChange = useCallback(
    (_: unknown, newValue: (string | FacetValue)[]) => {
      const selected = newValue.map((v) =>
        typeof v === 'string' ? v : v.label,
      );
      onChange(selected, buildFilterString(selected));
    },
    [onChange, buildFilterString],
  );

  return (
    <>
      {facetFields.length > 1 && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => {
            setActiveTab(v);
            // Reset selections when switching tabs
            onChange([], '');
          }}
          sx={{ mb: 1, minHeight: 0 }}
        >
          {facetFields.map((field) => (
            <Tab key={field} label={field} sx={{ textTransform: 'capitalize' }} />
          ))}
        </Tabs>
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
        getOptionLabel={(opt) =>
          typeof opt === 'string' ? opt : opt.label
        }
        isOptionEqualToValue={(opt, val) => opt.label === val.label}
        renderOption={({ key, ...props }, option) => (
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
            const count =
              typeof option === 'string' ? 0 : option.count;
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
