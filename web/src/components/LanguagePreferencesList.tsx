import { isNonEmptyString } from '@/helpers/util';
import languages from '@cospired/i18n-iso-languages';
import en from '@cospired/i18n-iso-languages/langs/en.json';
import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { LanguagePreference } from '@tunarr/types';
import { entries, map, reject, sortBy } from 'lodash-es';
import { FieldError } from 'react-hook-form';

// Initialize the languages database with English names
languages.registerLocale(en);

interface LanguagePreferencesListProps {
  preferences: LanguagePreference[];
  onChange: (preferences: LanguagePreference[]) => void;
  error?: FieldError;
}

// Get all available languages as a map of ISO 639-1 codes to display names
const languageOptions = sortBy(
  seq.collect(entries(languages.getNames('en')), ([code, name]) => {
    const iso6392 = languages.alpha2ToAlpha3B(code);
    if (!iso6392) {
      return;
    }
    return {
      iso6391: code,
      iso6392,
      displayName: name,
    } satisfies LanguagePreference;
  }),
  (opt) => opt.displayName,
);

export function LanguagePreferencesList({
  preferences,
  onChange,
  error,
}: LanguagePreferencesListProps) {
  console.log(error);
  const handleChange = (value: LanguagePreference[]) => {
    onChange(value);
  };

  const preferenceCodes = map(preferences, (pref) => pref.iso6392);

  return (
    <Stack>
      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Audio Language Preferences
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Configure preferred audio languages globally.
      </Typography>
      <Autocomplete
        multiple
        fullWidth
        value={preferences}
        onChange={(_, newValue) => handleChange(newValue)}
        options={reject(languageOptions, ({ iso6392 }) =>
          preferenceCodes.includes(iso6392),
        )}
        getOptionLabel={(option) => option.displayName}
        isOptionEqualToValue={(option, value) =>
          option.iso6391 === value.iso6391
        }
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
    </Stack>
  );
}
