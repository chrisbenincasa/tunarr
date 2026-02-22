import type {
  FormControlProps,
  FormHelperTextProps,
  SelectProps,
} from '@mui/material';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import { identity } from 'lodash-es';
import { useMemo } from 'react';
import type { StrictOmit } from 'ts-essentials';
import type { DropdownOption } from '../../helpers/DropdownOption';
import { useFieldContext } from '../../hooks/form.ts';

export interface Converter<In, Out> {
  to: (input: In) => Out;
  from: (out: Out) => In;
}

type Props<FieldTypeT, InputTypeT extends string | number> = {
  options: DropdownOption<InputTypeT>[] | readonly DropdownOption<InputTypeT>[];
  converter: Converter<FieldTypeT, InputTypeT>;
  helperText?: string;
  selectProps?: SelectProps;
  formControlProps?: FormControlProps;
  formHelperTextProps?: FormHelperTextProps;
};

function identityConverter<T>(): Converter<T, T> {
  return {
    to: identity,
    from: identity,
  };
}

export function BasicSelectInput<ValueTypeT extends string | number>(
  props: StrictOmit<Props<ValueTypeT, ValueTypeT>, 'converter'>,
) {
  const converter = useMemo(() => identityConverter<ValueTypeT>(), []);
  return <SelectInput {...props} converter={converter} />;
}

export function SelectInput<ValueTypeT, InputTypeT extends string | number>({
  options,
  selectProps,
  formControlProps,
  formHelperTextProps,
  helperText,
  converter,
}: Props<ValueTypeT, InputTypeT>) {
  const field = useFieldContext<ValueTypeT>();
  return (
    <FormControl {...formControlProps}>
      {isNonEmptyString(selectProps?.label) ? (
        <InputLabel>{selectProps?.label}</InputLabel>
      ) : null}
      <Select
        {...selectProps}
        value={converter.to(field.state.value)}
        onChange={(e) =>
          field.handleChange(converter.from(e.target.value as InputTypeT))
        }
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.description}
          </MenuItem>
        ))}
      </Select>
      {isNonEmptyString(helperText) ? (
        <FormHelperText {...formHelperTextProps}>{helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
}
