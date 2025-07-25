import languages from '@cospired/i18n-iso-languages/index';
import type {
  AutocompleteChangeReason,
  AutocompleteProps,
  TextFieldProps,
} from '@mui/material';
import { Autocomplete, TextField } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { entries, isUndefined, map, reject, sortBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { FieldError } from 'react-hook-form';
import { isNonEmptyString } from '../helpers/util.ts';

type Props = {
  values: LanguagePreferenceValue[];
  onSelect: (
    v: LanguagePreferenceValue,
    allValues: LanguagePreferenceValue[],
  ) => void;
  onRemove: (
    v: LanguagePreferenceValue,
    allValues: LanguagePreferenceValue[],
  ) => void;
  onClear?: () => void;
  error?: FieldError;
  showValues?: boolean;
  helperText?: string;
  allowMultiple?: boolean;
  textFieldProps?: TextFieldProps;
} & Pick<
  AutocompleteProps<LanguagePreferenceValue, true, false, false>,
  'fullWidth' | 'sx'
>;

export type LanguagePreferenceValue = {
  iso6392: string;
  label: string;
};

export const LanguageAutocomplete = ({
  values,
  onSelect,
  onRemove,
  onClear,
  error,
  showValues,
  helperText,
  allowMultiple,
  textFieldProps,
  ...rest
}: Props) => {
  const selectedCodes = useMemo(
    () => map(values, (pref) => pref.iso6392),
    [values],
  );

  const languageOptions = useMemo(
    () =>
      sortBy(
        seq.collect(entries(languages.getNames('en')), ([code, name]) => {
          const iso6392 = languages.alpha2ToAlpha3B(code);
          if (!iso6392) {
            return;
          }
          return {
            iso6392,
            label: name,
          } satisfies LanguagePreferenceValue;
        }),
        (opt) => opt.label,
      ),
    [],
  );

  const handleChange = useCallback(
    (
      opt: LanguagePreferenceValue,
      reason: AutocompleteChangeReason,
      allValues: LanguagePreferenceValue[],
    ) => {
      switch (reason) {
        case 'selectOption':
          onSelect(opt, allValues);
          break;
        case 'removeOption':
          onRemove(opt, allValues);
          break;
        case 'clear':
          onClear?.();
          break;
        default:
          break;
      }
    },
    [onClear, onRemove, onSelect],
  );

  allowMultiple = isUndefined(allowMultiple) || allowMultiple;

  const opts = useMemo(() => {
    if (allowMultiple) {
      return languageOptions;
    }
    return reject(languageOptions, ({ iso6392 }) =>
      selectedCodes.includes(iso6392),
    );
  }, [allowMultiple, languageOptions, selectedCodes]);

  return (
    <Autocomplete
      multiple
      {...rest}
      value={values}
      onChange={(_, newValue, reason, details) => {
        if (details) {
          handleChange(details.option, reason, newValue);
        }
      }}
      options={opts}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) =>
        !allowMultiple ? option.iso6392 === value.iso6392 : false
      }
      renderValue={!showValues ? () => null : undefined}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Language"
          variant="outlined"
          helperText={
            <span>
              {helperText ?? ''}
              {isNonEmptyString(error?.message) && (
                <>
                  <br />
                  {error.message}
                </>
              )}
            </span>
          }
          error={!!error}
          {...textFieldProps}
        />
      )}
    />
  );
};
