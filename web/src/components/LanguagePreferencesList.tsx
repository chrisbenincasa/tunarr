import { isNonEmptyString } from '@/helpers/util';
import { Autocomplete, TextField } from '@mui/material';
import type { LanguagePreference } from '@tunarr/types';
import { map, reject } from 'lodash-es';
import type { FieldError } from 'react-hook-form';
import { useLanguageOptions } from '../hooks/useLanguagePreferences.ts';

interface LanguagePreferencesListProps {
  preferences: LanguagePreference[];
  onChange: (preferences: LanguagePreference[]) => void;
  error?: FieldError;
}

export function LanguagePreferencesList({
  preferences,
  onChange,
  error,
}: LanguagePreferencesListProps) {
  const handleChange = (value: LanguagePreference[]) => {
    onChange(value);
  };

  const languageOptions = useLanguageOptions();
  const preferenceCodes = map(preferences, (pref) => pref.iso6392);

  return (
    <Autocomplete
      multiple
      fullWidth
      value={preferences}
      onChange={(_, newValue) => handleChange(newValue)}
      options={reject(languageOptions, ({ iso6392 }) =>
        preferenceCodes.includes(iso6392),
      )}
      getOptionLabel={(option) => option.displayName}
      isOptionEqualToValue={(option, value) => option.iso6391 === value.iso6391}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Language"
          variant="outlined"
          helperText={
            <span>
              The selected languages will be considered in order they are
              selected.
              {isNonEmptyString(error?.message) && (
                <>
                  <br />
                  {error.message}
                </>
              )}
            </span>
          }
          error={!!error}
        />
      )}
    />
  );
}
