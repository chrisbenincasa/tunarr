import type { FormControlProps, FormHelperTextProps } from '@mui/material';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
} from '@mui/material';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { useFieldContext } from '../../hooks/form.ts';

type Props = {
  label: string;
  formControlProps?: FormControlProps;
  helperText?: ReactNode;
  formHelperTextProps?: FormHelperTextProps;
};

export function BasicCheckboxInput({
  formControlProps,
  formHelperTextProps,
  helperText,
  label,
}: Props) {
  const field = useFieldContext<boolean>();
  return (
    <FormControl {...formControlProps}>
      <FormControlLabel
        control={
          <Checkbox
            value={field.state.value}
            checked={field.state.value}
            onChange={(_, checked) => field.handleChange(checked)}
          />
        }
        label={label}
      />
      {!isNil(helperText) && (
        <FormHelperText {...formHelperTextProps}>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
}
