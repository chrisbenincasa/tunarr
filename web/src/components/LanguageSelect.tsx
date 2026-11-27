import languages from '@cospired/i18n-iso-languages';
import { useLingui } from '@lingui/react/macro';
import type { TextFieldProps } from '@mui/material';
import { Autocomplete, TextField } from '@mui/material';
import type { LanguagePreference } from '@tunarr/types';
import { useMemo } from 'react';
import { isNonEmptyString } from '../helpers/util.ts';
import { languageOptions } from '../hooks/useLanguagePreferences.ts';

type Props = {
  value: string;
  onChange: (code: string) => void;
  textFieldProps?: TextFieldProps;
};

/**
 * Picks one language and shows it by name. A saved code with no matching
 * option, such as a custom code from a hand-written condition, shows as typed.
 */
export const LanguageSelect = ({ value, onChange, textFieldProps }: Props) => {
  const { t } = useLingui();

  const selected = useMemo((): LanguagePreference | null => {
    if (!isNonEmptyString(value)) {
      return null;
    }
    const lower = value.trim().toLowerCase();
    const code = languages.toAlpha3T(lower) ?? lower;
    return (
      languageOptions.find((opt) => opt.iso6392 === code) ?? {
        iso6391: '',
        iso6392: value,
        displayName: value,
      }
    );
  }, [value]);

  const options = useMemo(
    () =>
      selected && !languageOptions.includes(selected)
        ? [selected, ...languageOptions]
        : languageOptions,
    [selected],
  );

  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_, opt) => onChange(opt?.iso6392 ?? '')}
      getOptionLabel={(opt) => opt.displayName}
      isOptionEqualToValue={(opt, val) => opt.iso6392 === val.iso6392}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t`Language`}
          variant="outlined"
          {...textFieldProps}
        />
      )}
    />
  );
};
