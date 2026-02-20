import type { SearchFieldSpec } from '@/helpers/searchBuilderConstants.ts';
import { numericBij } from '@/helpers/searchBuilderConstants.ts';
import type { FieldKey, FieldPrefix } from '@/types/SearchBuilder.ts';
import { TextField } from '@mui/material';
import { isNumber2Tuple } from '@tunarr/shared/util';
import { castArray, isNumber } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { SearchForm } from './SearchInput.tsx';

type Props = {
  // field: NumericSearchField;
  uiSpec: SearchFieldSpec<'numeric'>;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
};

export const NumericValueSearchNode = ({ uiSpec, formKey }: Props) => {
  const { control } = useFormContext<SearchForm>();

  const handleValueChange = useCallback(
    (
      // spec: SearchFieldSpec<SearchField['type']>,
      value: string,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      const fromUiValue = (uiSpec.uiBijection ?? numericBij).from(value);
      if (uiSpec.bijection) {
        originalOnChange(uiSpec.bijection.to(fromUiValue));
      } else {
        if (isNaN(fromUiValue)) {
          return;
        }
        originalOnChange(fromUiValue);
      }
    },
    [uiSpec.bijection, uiSpec.uiBijection],
  );

  return (
    <Controller
      control={control}
      name={`${formKey}.value`}
      render={({ field }) => {
        // Have to do this check for TS even though we know it's true.
        if (!isNumber(field.value) && !isNumber2Tuple(field.value)) {
          return <></>;
        }

        let v = castArray(field.value)[0];
        if (uiSpec.bijection) {
          v = uiSpec.bijection.from(v);
        }

        return (
          <TextField
            label="Value"
            size="small"
            value={v}
            onChange={(e) => handleValueChange(e.target.value, field.onChange)}
          />
        );
      }}
    />
  );
};
